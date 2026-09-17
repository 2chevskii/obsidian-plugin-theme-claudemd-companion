import { describe, expect, it, vi } from "vitest";

import {
  copyScrollPositions,
  isClaudeTheme,
  isMotionEnabled,
  prefersReducedMotion,
  rectIntersects,
  removeDuplicateIds,
  snapshotTextStyle
} from "./dom-utils";
import { enableMotion, rect } from "./test-helpers";

describe("DOM utilities", () => {
  it("detects the active theme and reduced-motion preference", () => {
    expect(isClaudeTheme(document)).toBe(false);
    expect(prefersReducedMotion(document)).toBe(false);
    expect(isMotionEnabled(document)).toBe(false);

    enableMotion();
    expect(isClaudeTheme(document)).toBe(true);
    expect(isMotionEnabled(document)).toBe(true);

    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedMotion(document)).toBe(true);
    expect(isMotionEnabled(document)).toBe(false);
  });

  it("tests rectangle overlap without treating touching edges as overlap", () => {
    expect(rectIntersects(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
    expect(rectIntersects(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    expect(rectIntersects(rect(0, 0, 10, 10), rect(0, 10, 10, 10))).toBe(false);
  });

  it("removes IDs and retains matching nested scroll positions on a ghost", () => {
    const source = document.createElement("div");
    source.id = "source";
    source.innerHTML = '<div id="child"></div>';
    source.scrollTop = 3;
    source.scrollLeft = 4;
    const child = source.firstElementChild as HTMLElement;
    child.scrollTop = 5;
    child.scrollLeft = 6;
    const clone = source.cloneNode(true) as HTMLElement;

    removeDuplicateIds(clone);
    copyScrollPositions(source, clone);

    expect(clone.querySelectorAll("[id]")).toHaveLength(0);
    expect(clone.scrollTop).toBe(3);
    expect(clone.scrollLeft).toBe(4);
    expect((clone.firstElementChild as HTMLElement).scrollTop).toBe(5);
    expect((clone.firstElementChild as HTMLElement).scrollLeft).toBe(6);
  });

  it("tolerates clone structures that end before the source structure", () => {
    const source = document.createElement("div");
    source.append(document.createElement("span"));
    const clone = document.createElement("div");
    copyScrollPositions(source, clone);
    expect(clone.scrollTop).toBe(0);
  });

  it("copies the text style fields used by heading ghosts", () => {
    const element = document.createElement("span");
    element.style.cssText = "color: red; font-family: serif; font-size: 13px; font-style: italic; font-weight: 700; letter-spacing: 2px; line-height: 20px";
    expect(snapshotTextStyle(getComputedStyle(element))).toMatchObject({
      color: "rgb(255, 0, 0)",
      fontFamily: "serif",
      fontSize: "13px",
      fontStyle: "italic",
      fontWeight: "700",
      letterSpacing: "2px",
      lineHeight: "20px"
    });
  });
});
