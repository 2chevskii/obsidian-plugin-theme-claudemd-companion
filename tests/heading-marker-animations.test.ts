import { describe, expect, it, vi } from "vitest";

import { AnimationRegistry } from "../src/animations/animation-registry";
import { HeadingMarkerAnimator, mutationTouchesHeadingMarker } from "../src/animations/heading-marker-animations";
import { enableMotion, installAnimationStubs, rect, setRect } from "./test-helpers";

function createHeading(): { root: HTMLElement; line: HTMLElement; marker: HTMLElement; title: HTMLElement } {
  const root = document.createElement("div");
  root.className = "markdown-source-view is-live-preview";
  root.innerHTML = '<div class="cm-content"><div class="HyperMD-header cm-active"><span class="cm-formatting-header" id="marker">#</span><span class="cm-header">Title</span></div></div>';
  document.body.append(root);
  return {
    root,
    line: root.querySelector(".HyperMD-header")!,
    marker: root.querySelector(".cm-formatting-header")!,
    title: root.querySelector(".cm-header")!
  };
}

describe("HeadingMarkerAnimator", () => {
  it("does nothing unless theme motion is enabled", () => {
    const { marker } = createHeading();
    const animator = new HeadingMarkerAnimator(new AnimationRegistry());
    animator.capture(document);
    marker.remove();
    animator.flushExits(document);
    expect(document.querySelector(".ctc-heading-marker-exit")).toBeNull();
  });

  it("captures a marker and ghosts it after it is removed", () => {
    vi.useFakeTimers();
    enableMotion();
    const { marker } = createHeading();
    setRect(marker, rect(10, 20, 5, 15));
    const animator = new HeadingMarkerAnimator(new AnimationRegistry());
    animator.capture(document);
    marker.remove();
    animator.flushExits(document);
    const ghost = document.querySelector<HTMLElement>(".ctc-heading-marker-exit");
    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute("aria-hidden")).toBe("true");
    expect(ghost?.id).toBe("");
    expect(ghost?.style.cssText).toContain("left: 10px");
    vi.advanceTimersByTime(200);
    expect(ghost?.isConnected).toBe(false);
  });

  it("refreshes an existing marker snapshot and finds replacement content in the editor root", () => {
    vi.useFakeTimers();
    enableMotion();
    installAnimationStubs();
    const { marker, line, title } = createHeading();
    setRect(marker, rect(10, 20, 5, 15));
    setRect(title, rect(20, 20, 60, 15));
    const animator = new HeadingMarkerAnimator(new AnimationRegistry());
    animator.capture(document);
    animator.capture(document);
    marker.remove();
    line.remove();
    const replacement = document.createElement("div");
    replacement.className = "HyperMD-header";
    replacement.innerHTML = '<span class="cm-header">Title</span>';
    document.querySelector(".cm-content")!.append(replacement);
    const replacementTitle = replacement.querySelector<HTMLElement>(".cm-header")!;
    setRect(replacementTitle, rect(10, 20, 60, 15));
    animator.flushExits(document);
    expect(document.querySelector(".ctc-heading-title-exit")).not.toBeNull();
  });

  it("animates the title to its new position when the marker is removed", () => {
    vi.useFakeTimers();
    const { animate } = installAnimationStubs();
    enableMotion();
    const { marker, title } = createHeading();
    setRect(marker, rect(10, 20, 5, 15));
    setRect(title, rect(20, 20, 60, 15));
    const animator = new HeadingMarkerAnimator(new AnimationRegistry());
    animator.capture(document);
    marker.remove();
    setRect(title, rect(10, 20, 60, 15));
    animator.flushExits(document);
    expect(document.querySelector(".ctc-heading-title-exit")).not.toBeNull();
    expect(title.closest(".HyperMD-header")?.classList.contains("ctc-heading-title-exiting")).toBe(true);
    expect(animate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(title.closest(".HyperMD-header")?.classList.contains("ctc-heading-title-exiting")).toBe(false);
  });

  it("keeps live markers, ignores a replacement marker, and skips zero-size exits", () => {
    enableMotion();
    const { marker, line } = createHeading();
    setRect(marker, rect(0, 0, 0, 0));
    const animator = new HeadingMarkerAnimator(new AnimationRegistry());
    animator.capture(document);
    animator.flushExits(document);
    expect(document.querySelector(".ctc-heading-marker-exit")).toBeNull();
    marker.remove();
    const replacement = document.createElement("span");
    replacement.className = "cm-formatting-header";
    line.prepend(replacement);
    animator.flushExits(document);
    expect(document.querySelector(".ctc-heading-marker-exit")).toBeNull();
  });

  it("classifies mutations that add or remove heading markers", () => {
    const node = document.createElement("div");
    node.innerHTML = '<span class="cm-formatting-header"></span>';
    const records = [
      { addedNodes: [node], removedNodes: [] },
      { addedNodes: [], removedNodes: [node] }
    ] as unknown as MutationRecord[];
    expect(mutationTouchesHeadingMarker(document, records)).toEqual({ added: true, removed: true });
    expect(mutationTouchesHeadingMarker(document, [])).toEqual({ added: false, removed: false });
  });
});
