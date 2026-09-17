import type { HeadingMarkerSnapshot } from "./animation-types";
import { AnimationRegistry } from "./animation-registry";
import { HEADING_MARKER_EXIT_MS } from "./constants";
import { isMotionEnabled, removeDuplicateIds, snapshotTextStyle } from "../dom/dom-utils";

const ACTIVE_MARKER_SELECTOR = ".markdown-source-view.is-live-preview .HyperMD-header.cm-active > .cm-formatting-header";
const HEADING_CONTENT_SELECTOR = ":scope > .cm-header:not(.cm-formatting)";

export class HeadingMarkerAnimator {
  private readonly snapshots = new WeakMap<Document, HeadingMarkerSnapshot[]>();

  constructor(private readonly registry: AnimationRegistry) {}

  capture(doc: Document): void {
    if (!isMotionEnabled(doc) || !doc.defaultView) return;
    const currentSnapshots = Array.from(doc.querySelectorAll<HTMLElement>(ACTIVE_MARKER_SELECTOR))
      .map((source) => createSnapshot(source, doc.defaultView!));
    const snapshots = this.snapshots.get(doc) ?? [];
    currentSnapshots.forEach((snapshot) => {
      const index = snapshots.findIndex((existing) => existing.source === snapshot.source);
      if (index >= 0) snapshots[index] = snapshot;
      else snapshots.push(snapshot);
    });
    if (snapshots.length) this.snapshots.set(doc, snapshots);
  }

  flushExits(doc: Document): void {
    const snapshots = this.snapshots.get(doc);
    if (!snapshots?.length || !isMotionEnabled(doc)) return;
    const remaining: HeadingMarkerSnapshot[] = [];
    snapshots.forEach((snapshot) => {
      if (snapshot.source.isConnected) {
        remaining.push(snapshot);
        return;
      }
      if (snapshot.line?.isConnected && snapshot.line.querySelector(".cm-formatting-header")) return;
      if (snapshot.rect.width === 0 || snapshot.rect.height === 0) return;
      this.animateTitleExit(snapshot, doc);
      this.animateMarkerExit(snapshot, doc);
    });
    if (remaining.length) this.snapshots.set(doc, remaining);
    else this.snapshots.delete(doc);
  }

  private animateTitleExit(snapshot: HeadingMarkerSnapshot, doc: Document): void {
    const content = findCurrentContent(snapshot);
    if (!content || !snapshot.contentRect || !snapshot.contentClone || !snapshot.contentStyle) return;
    const deltaX = content.getBoundingClientRect().left - snapshot.contentRect.left;
    const currentLine = content.closest<HTMLElement>(".HyperMD-header");
    if (!currentLine || Math.abs(deltaX) < 0.5) return;

    const ghost = snapshot.contentClone;
    removeDuplicateIds(ghost);
    ghost.classList.add("ctc-heading-title-exit");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("contenteditable", "false");
    Object.assign(ghost.style, {
      position: "fixed",
      inset: "auto",
      left: `${snapshot.contentRect.left}px`,
      top: `${snapshot.contentRect.top}px`,
      width: `${snapshot.contentRect.width}px`,
      height: `${snapshot.contentRect.height}px`,
      margin: "0",
      ...snapshot.contentStyle,
      lineHeight: `${snapshot.contentRect.height}px`,
      pointerEvents: "none",
      zIndex: "99999"
    });
    currentLine.classList.add("ctc-heading-title-exiting");
    this.registry.trackHeadingTitleLine(currentLine);
    doc.body.appendChild(ghost);
    this.registry.trackGhost(ghost);
    ghost.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${deltaX}px)` }],
      { duration: HEADING_MARKER_EXIT_MS, easing: "cubic-bezier(0.34, 0.55, 0.25, 1.08)", fill: "both" }
    );
    const win = doc.defaultView ?? window;
    const timer = win.setTimeout(() => {
      currentLine.classList.remove("ctc-heading-title-exiting");
      this.registry.forgetHeadingTitleLine(currentLine);
      ghost.remove();
      this.registry.forgetGhost(ghost);
      this.registry.forgetTimer(timer);
    }, HEADING_MARKER_EXIT_MS);
    this.registry.trackTimer(timer);
  }

  private animateMarkerExit(snapshot: HeadingMarkerSnapshot, doc: Document): void {
    const ghost = snapshot.clone;
    removeDuplicateIds(ghost);
    ghost.classList.add("ctc-heading-marker-exit");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("contenteditable", "false");
    Object.assign(ghost.style, {
      position: "fixed",
      inset: "auto",
      left: `${snapshot.rect.left}px`,
      top: `${snapshot.rect.top}px`,
      width: `${snapshot.rect.width}px`,
      height: `${snapshot.rect.height}px`,
      margin: "0",
      ...snapshot.style,
      pointerEvents: "none",
      zIndex: "99999"
    });
    doc.body.appendChild(ghost);
    this.registry.trackGhost(ghost);
    this.registry.removeAfter(ghost, HEADING_MARKER_EXIT_MS);
  }
}

export function mutationTouchesHeadingMarker(doc: Document, records: MutationRecord[]): { added: boolean; removed: boolean } {
  const HTMLElementConstructor: typeof HTMLElement | undefined = doc.defaultView?.HTMLElement;
  if (!HTMLElementConstructor) return { added: false, removed: false };
  const isHTMLElement = (node: Node): node is HTMLElement =>
    Object.prototype.isPrototypeOf.call(HTMLElementConstructor.prototype, node);
  const containsMarker = (node: Node): boolean => isHTMLElement(node)
    && (node.matches(".cm-formatting-header, .HyperMD-header")
      || Boolean(node.querySelector(".cm-formatting-header")));
  return {
    removed: records.some((record) => [...record.removedNodes].some(containsMarker)),
    added: records.some((record) => [...record.addedNodes].some(containsMarker))
  };
}

function createSnapshot(source: HTMLElement, win: Window): HeadingMarkerSnapshot {
  const line = source.closest<HTMLElement>(".HyperMD-header");
  const content = line?.querySelector<HTMLElement>(HEADING_CONTENT_SELECTOR) ?? null;
  return {
    source,
    line,
    editorRoot: source.closest<HTMLElement>(".cm-content"),
    contentText: content?.textContent ?? "",
    contentRect: content?.getBoundingClientRect() ?? null,
    contentClone: content?.cloneNode(true) as HTMLElement | null,
    contentStyle: content ? snapshotTextStyle(win.getComputedStyle(content)) : null,
    clone: source.cloneNode(true) as HTMLElement,
    rect: source.getBoundingClientRect(),
    style: snapshotTextStyle(win.getComputedStyle(source))
  };
}

function findCurrentContent(snapshot: HeadingMarkerSnapshot): HTMLElement | null {
  const lineContent = snapshot.line?.isConnected
    ? snapshot.line.querySelector<HTMLElement>(HEADING_CONTENT_SELECTOR)
    : null;
  if (lineContent || !snapshot.editorRoot?.isConnected || !snapshot.contentRect) return lineContent;
  return Array.from(snapshot.editorRoot.querySelectorAll<HTMLElement>(
    ".HyperMD-header > .cm-header:not(.cm-formatting)"
  )).filter((candidate) => candidate.textContent === snapshot.contentText)
    .sort((left, right) => (
      Math.abs(left.getBoundingClientRect().top - snapshot.contentRect!.top)
      - Math.abs(right.getBoundingClientRect().top - snapshot.contentRect!.top)
    ))[0] ?? null;
}
