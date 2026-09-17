import { describe, expect, it, vi } from "vitest";

import { AnimationRegistry } from "../src/animations/animation-registry";

describe("AnimationRegistry", () => {
  it("removes tracked ghosts after their duration", () => {
    vi.useFakeTimers();
    const registry = new AnimationRegistry();
    const ghost = document.createElement("div");
    document.body.append(ghost);
    registry.trackGhost(ghost);
    registry.removeAfter(ghost, 10);
    vi.advanceTimersByTime(60);
    expect(ghost.isConnected).toBe(false);
  });

  it("cancels timers, removes ghosts, and restores hidden heading titles", () => {
    vi.useFakeTimers();
    const registry = new AnimationRegistry();
    const ghost = document.createElement("div");
    const heading = document.createElement("div");
    heading.classList.add("ctc-heading-title-exiting");
    document.body.append(ghost, heading);
    registry.trackGhost(ghost);
    registry.trackHeadingTitleLine(heading);
    registry.trackTimer(window.setTimeout(vi.fn(), 100));

    registry.dispose();
    vi.advanceTimersByTime(100);
    expect(ghost.isConnected).toBe(false);
    expect(heading.classList.contains("ctc-heading-title-exiting")).toBe(false);
  });

  it("falls back to the global window when an element document has no default view", () => {
    vi.useFakeTimers();
    const registry = new AnimationRegistry();
    const foreignDocument = document.implementation.createHTMLDocument("no-window");
    const ghost = foreignDocument.createElement("div");
    foreignDocument.body.append(ghost);
    registry.trackGhost(ghost);
    registry.removeAfter(ghost, 0);
    vi.advanceTimersByTime(50);
    expect(ghost.isConnected).toBe(false);
  });
});
