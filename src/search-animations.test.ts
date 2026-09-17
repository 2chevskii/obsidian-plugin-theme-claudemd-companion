import { describe, expect, it, vi } from "vitest";

import { AnimationRegistry } from "./animation-registry";
import {
  findSearchContext,
  getSearchItemKeys,
  getSearchItems,
  SearchAnimator
} from "./search-animations";
import { installAnimationStubs, rect, setRect } from "./test-helpers";

function createPrompt(): { input: HTMLInputElement; results: HTMLElement } {
  const prompt = document.createElement("div");
  prompt.className = "prompt";
  const input = document.createElement("input");
  input.className = "prompt-input";
  const results = document.createElement("div");
  results.className = "prompt-results";
  prompt.append(input, results);
  document.body.append(prompt);
  return { input, results };
}

describe("search animations", () => {
  it("recognizes prompt and settings search contexts", () => {
    const { input, results } = createPrompt();
    expect(findSearchContext(input)).toEqual({ container: results, kind: "prompt" });

    const modal = document.createElement("div");
    modal.className = "modal mod-settings";
    modal.innerHTML = '<div class="setting-search-container"><input type="search"></div><div class="setting-search-results"></div>';
    document.body.append(modal);
    const settingsInput = modal.querySelector<HTMLInputElement>("input")!;
    expect(findSearchContext(settingsInput)).toEqual({
      container: modal.querySelector(".setting-search-results"),
      kind: "settings"
    });
    expect(findSearchContext(document.createElement("input"))).toBeNull();
  });

  it("selects only direct current items and creates stable duplicate keys", () => {
    const { results } = createPrompt();
    results.innerHTML = '<div class="suggestion-item" data-path="a"></div><div class="suggestion-item" data-path="a"></div><div class="suggestion-item ctc-search-exit-item"></div><div><div class="suggestion-item"></div></div>';
    const items = getSearchItems({ container: results, kind: "prompt" });
    expect(items).toHaveLength(2);
    expect(getSearchItemKeys(items, "prompt")).toEqual(["prompt:a:0", "prompt:a:1"]);
    expect(getSearchItems({ container: results, kind: "settings" })).toHaveLength(0);
  });

  it("moves retained entries, introduces new entries, and ghosts removed visible entries", () => {
    vi.useFakeTimers();
    const { animate, cancel } = installAnimationStubs();
    const { results } = createPrompt();
    results.innerHTML = '<div class="suggestion-item" data-path="keep">Keep</div><div class="suggestion-item" data-path="remove" id="remove">Remove</div>';
    setRect(results, rect(0, 0, 100, 100));
    const initial = getSearchItems({ container: results, kind: "prompt" });
    setRect(initial[0], rect(0, 10));
    setRect(initial[1], rect(0, 40));
    const animator = new SearchAnimator(new AnimationRegistry());
    const context = { container: results, kind: "prompt" as const };
    animator.capture(context);
    expect(cancel).toHaveBeenCalledTimes(2);

    results.innerHTML = '<div class="suggestion-item" data-path="keep">Keep</div><div class="suggestion-item" data-path="new">New</div>';
    const current = getSearchItems(context);
    setRect(current[0], rect(0, 20));
    setRect(current[1], rect(0, 50));
    animator.animateChanges(context);

    expect(animate).toHaveBeenCalledTimes(3);
    const ghost = results.querySelector<HTMLElement>(".ctc-search-exit-item");
    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute("aria-hidden")).toBe("true");
    expect(ghost?.id).toBe("");
    vi.advanceTimersByTime(260);
    expect(results.classList.contains("ctc-search-animating")).toBe(false);
  });

  it("skips unchanged or offscreen entries and ignores absent or detached snapshots", () => {
    const { animate } = installAnimationStubs();
    const { results } = createPrompt();
    const item = document.createElement("div");
    item.className = "suggestion-item";
    results.append(item);
    setRect(results, rect(0, 0, 10, 10));
    setRect(item, rect(20, 20));
    const animator = new SearchAnimator(new AnimationRegistry());
    const context = { container: results, kind: "prompt" as const };
    animator.capture(context);
    animator.animateChanges(context);
    animator.animateChanges(context);
    results.remove();
    animator.animateChanges(context);
    expect(animate).not.toHaveBeenCalled();
  });

  it("debounces settings changes and invalidates superseded schedules", () => {
    vi.useFakeTimers();
    const animator = new SearchAnimator(new AnimationRegistry());
    const container = document.createElement("div");
    document.body.append(container);
    const context = { container, kind: "settings" as const };
    const animate = vi.spyOn(animator, "animateChanges");
    animator.schedule(context);
    animator.schedule(context);
    vi.advanceTimersByTime(70);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("schedules prompt changes on the next animation frame", () => {
    const animator = new SearchAnimator(new AnimationRegistry());
    const container = document.createElement("div");
    document.body.append(container);
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(1);
      return 1;
    });
    const animate = vi.spyOn(animator, "animateChanges");
    animator.schedule({ container, kind: "prompt" });
    expect(frame).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("drops superseded prompt frames and handles connected documents without windows", () => {
    const animator = new SearchAnimator(new AnimationRegistry());
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const container = document.createElement("div");
    document.body.append(container);
    const animate = vi.spyOn(animator, "animateChanges");
    animator.schedule({ container, kind: "prompt" });
    animator.schedule({ container, kind: "prompt" });
    callbacks.forEach((callback) => callback(1));
    expect(animate).toHaveBeenCalledTimes(1);
    const foreignDocument = document.implementation.createHTMLDocument("no-window");
    const foreignContainer = foreignDocument.createElement("div");
    foreignDocument.body.append(foreignContainer);
    animator.capture({ container: foreignContainer, kind: "prompt" });
    animator.animateChanges({ container: foreignContainer, kind: "prompt" });
  });

  it("handles missing result containers, fallback item keys, and documents without windows", () => {
    const promptInput = document.createElement("input");
    promptInput.className = "prompt-input";
    expect(findSearchContext(promptInput)).toBeNull();
    const settings = document.createElement("div");
    settings.className = "modal mod-settings";
    settings.innerHTML = '<div class="setting-search-container"><input type="search"></div>';
    expect(findSearchContext(settings.querySelector("input")!)).toBeNull();
    const items = ["value", "label", " text  value ", ""].map((value, index) => {
      const item = document.createElement("div");
      if (index === 0) item.dataset.value = value;
      else if (index === 1) item.setAttribute("aria-label", value);
      else item.textContent = value;
      return item;
    });
    expect(getSearchItemKeys(items, "settings")).toEqual([
      "settings:value:0", "settings:label:0", "settings:text value:0", "settings::0"
    ]);
    const foreignDocument = document.implementation.createHTMLDocument("no-window");
    const animator = new SearchAnimator(new AnimationRegistry());
    animator.schedule({ container: foreignDocument.createElement("div"), kind: "prompt" });
    animator.animateChanges({ container: foreignDocument.createElement("div"), kind: "prompt" });
  });
});
