import { describe, expect, it, vi } from "vitest";

import { AnimationRegistry } from "./animation-registry";
import { ExitAnimator, resolveModalContainer } from "./exit-animations";
import { enableMotion, rect, setRect } from "./test-helpers";

describe("ExitAnimator", () => {
  it("creates an inaccessible, fixed, ID-free ghost and copies scroll state", () => {
    vi.useFakeTimers();
    enableMotion();
    const source = document.createElement("div");
    source.id = "dialog";
    source.innerHTML = '<div id="desc"></div>';
    source.scrollTop = 9;
    (source.firstElementChild as HTMLElement).scrollLeft = 11;
    document.body.append(source);
    setRect(source, rect(10, 20, 30, 40));

    new ExitAnimator(new AnimationRegistry()).animate(source, "modal");
    const ghost = document.body.querySelector<HTMLElement>(".ctc-modal-exit-ghost");

    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute("aria-hidden")).toBe("true");
    expect(ghost?.inert).toBe(true);
    expect(ghost?.querySelectorAll("[id]")).toHaveLength(0);
    expect(ghost?.style.cssText).toContain("left: 10px");
    expect(ghost?.scrollTop).toBe(9);
    expect((ghost?.firstElementChild as HTMLElement).scrollLeft).toBe(11);
    vi.advanceTimersByTime(220);
    expect(ghost?.isConnected).toBe(false);
  });

  it("does not animate ineligible, duplicate, or zero-size sources", async () => {
    const animator = new ExitAnimator(new AnimationRegistry());
    const source = document.createElement("div");
    document.body.append(source);
    setRect(source, rect());
    animator.animate(source, "menu");
    expect(document.querySelector(".ctc-menu-exit-ghost")).toBeNull();

    enableMotion();
    setRect(source, rect(0, 0, 0, 20));
    animator.animate(source, "menu");
    expect(document.querySelector(".ctc-menu-exit-ghost")).toBeNull();

    setRect(source, rect());
    animator.animate(source, "menu");
    animator.animate(source, "menu");
    expect(document.querySelectorAll(".ctc-menu-exit-ghost")).toHaveLength(1);
    await Promise.resolve();
    animator.animate(source, "menu");
    expect(document.querySelectorAll(".ctc-menu-exit-ghost")).toHaveLength(2);
  });

  it("finds a modal container from itself, descendants, and missing elements", () => {
    const container = document.createElement("div");
    container.className = "modal-container";
    const child = document.createElement("div");
    container.append(child);
    document.body.append(container);
    expect(resolveModalContainer(container)).toBe(container);
    expect(resolveModalContainer(child)).toBe(container);
    expect(resolveModalContainer()).toBeNull();
  });
});
