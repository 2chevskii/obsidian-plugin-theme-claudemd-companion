import { describe, expect, it, vi } from "vitest";

import { AnimationRegistry } from "../src/animations/animation-registry";
import { HeadingMarkerAnimator } from "../src/animations/heading-marker-animations";
import { SearchAnimator } from "../src/animations/search-animations";
import { DocumentEffects, updateStatusBars } from "../src/effects/document-effects";
import { enableMotion, rect, setRect } from "./test-helpers";

describe("document effects", () => {
  it("activates status bars only in their virtual zone and clears them when disabled", () => {
    enableMotion();
    document.body.classList.add("claude-auto-hide-status-bar");
    const bar = document.createElement("div");
    bar.className = "status-bar";
    document.body.append(bar);
    setRect(bar, rect(10, 100, 50, 10));
    updateStatusBars(document, 8, 70);
    expect(bar.classList.contains("ctc-status-zone-active")).toBe(true);
    updateStatusBars(document, 100, 100);
    expect(bar.classList.contains("ctc-status-zone-active")).toBe(false);
    bar.classList.add("ctc-status-zone-active");
    document.body.classList.remove("claude-auto-hide-status-bar");
    updateStatusBars(document, 10, 100);
    expect(bar.classList.contains("ctc-status-zone-active")).toBe(false);
  });

  it("attaches once, routes search input, and releases all document listeners", () => {
    enableMotion();
    const registry = new AnimationRegistry();
    const search = new SearchAnimator(registry);
    const heading = new HeadingMarkerAnimator(registry);
    const cleanups: Array<() => void> = [];
    const effects = new DocumentEffects(registry, search, heading, (cleanup) => cleanups.push(cleanup));
    const capture = vi.spyOn(search, "capture");
    const schedule = vi.spyOn(search, "schedule");
    document.body.innerHTML = '<div class="prompt"><input class="prompt-input"><div class="prompt-results"></div></div>';
    effects.attach(document);
    effects.attach(document);
    expect(cleanups).toHaveLength(1);
    const input = document.querySelector<HTMLInputElement>("input")!;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(capture).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    document.body.classList.add("ctc-status-zone-active", "ctc-search-animating");
    effects.clearTransientClasses([document]);
    expect(document.body.classList.contains("claude-theme-companion")).toBe(false);
    expect(document.body.classList.contains("ctc-status-zone-active")).toBe(false);
    cleanups[0]();
  });

  it("coalesces pointer movement, handles pointer leave, and captures heading markers", () => {
    enableMotion();
    const registry = new AnimationRegistry();
    const search = new SearchAnimator(registry);
    const heading = new HeadingMarkerAnimator(registry);
    const cleanups: Array<() => void> = [];
    const effects = new DocumentEffects(registry, search, heading, (cleanup) => cleanups.push(cleanup));
    const capture = vi.spyOn(heading, "capture");
    const status = vi.spyOn(document.defaultView!, "requestAnimationFrame").mockImplementation((callback) => {
      callback(1);
      return 1;
    });
    document.body.innerHTML = '<div class="status-bar"></div>';
    setRect(document.querySelector(".status-bar")!, rect());
    effects.attach(document);
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 1, clientY: 1 }));
    document.dispatchEvent(new PointerEvent("pointerout", { relatedTarget: document.body }));
    document.dispatchEvent(new PointerEvent("pointerout"));
    document.dispatchEvent(new KeyboardEvent("keydown"));
    document.dispatchEvent(new FocusEvent("focusout"));
    expect(status).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(2);
    cleanups[0]();
  });

  it("ignores irrelevant input and exercises heading mutation directions", async () => {
    enableMotion();
    const registry = new AnimationRegistry();
    const search = new SearchAnimator(registry);
    const heading = new HeadingMarkerAnimator(registry);
    const cleanups: Array<() => void> = [];
    const effects = new DocumentEffects(registry, search, heading, (cleanup) => cleanups.push(cleanup));
    const capture = vi.spyOn(search, "capture");
    const flush = vi.spyOn(heading, "flushExits");
    document.body.innerHTML = '<input><div class="cm-formatting-header"></div>';
    effects.attach(document);
    document.querySelector("input")!.dispatchEvent(new Event("input", { bubbles: true }));
    document.body.append(document.createElement("div"));
    await Promise.resolve();
    document.querySelector(".cm-formatting-header")!.remove();
    await Promise.resolve();
    expect(capture).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
    cleanups[0]();
  });
});
