import { AnimationRegistry } from "../animations/animation-registry";
import { COMPANION_CLASS } from "../animations/constants";
import { HeadingMarkerAnimator, mutationTouchesHeadingMarker } from "../animations/heading-marker-animations";
import { isMotionEnabled } from "../dom/dom-utils";
import { findSearchContext, SearchAnimator } from "../animations/search-animations";

export class DocumentEffects {
  private readonly attachedDocuments = new WeakSet<Document>();

  constructor(
    private readonly registry: AnimationRegistry,
    private readonly searchAnimator: SearchAnimator,
    private readonly headingAnimator: HeadingMarkerAnimator,
    private readonly registerCleanup: (cleanup: () => void) => void
  ) {}

  attach(doc: Document): void {
    if (this.attachedDocuments.has(doc)) return;
    this.attachedDocuments.add(doc);
    doc.body.classList.add(COMPANION_CLASS);
    let pointerFrame = 0;
    let pointerX = -1;
    let pointerY = -1;
    const updateStatusBar = () => {
      pointerFrame = 0;
      updateStatusBars(doc, pointerX, pointerY);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = doc.defaultView?.requestAnimationFrame(updateStatusBar) ?? 0;
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      pointerX = -1;
      pointerY = -1;
      updateStatusBars(doc, pointerX, pointerY);
    };
    const onInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof doc.defaultView!.HTMLInputElement) || !isMotionEnabled(doc)) return;
      const context = findSearchContext(input);
      if (!context) return;
      this.searchAnimator.capture(context);
      this.searchAnimator.schedule(context);
    };
    const captureHeadingMarkers = () => this.headingAnimator.capture(doc);
    const observer = new MutationObserver((records) => {
      const changes = mutationTouchesHeadingMarker(doc, records);
      if (changes.removed) this.headingAnimator.flushExits(doc);
      if (changes.added) doc.defaultView?.requestAnimationFrame(captureHeadingMarkers);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener("pointermove", onPointerMove, { passive: true });
    doc.addEventListener("pointerout", onPointerOut, { passive: true });
    doc.addEventListener("input", onInput, true);
    doc.addEventListener("pointerdown", captureHeadingMarkers, true);
    doc.addEventListener("keydown", captureHeadingMarkers, true);
    doc.addEventListener("focusout", captureHeadingMarkers, true);
    this.registerCleanup(() => {
      if (pointerFrame) doc.defaultView?.cancelAnimationFrame(pointerFrame);
      doc.removeEventListener("pointermove", onPointerMove);
      doc.removeEventListener("pointerout", onPointerOut);
      doc.removeEventListener("input", onInput, true);
      doc.removeEventListener("pointerdown", captureHeadingMarkers, true);
      doc.removeEventListener("keydown", captureHeadingMarkers, true);
      doc.removeEventListener("focusout", captureHeadingMarkers, true);
      observer.disconnect();
      doc.body.classList.remove(COMPANION_CLASS);
    });
  }

  clearTransientClasses(documents: Iterable<Document>): void {
    for (const doc of documents) {
      doc.body.classList.remove(COMPANION_CLASS);
      doc.querySelectorAll(".ctc-status-zone-active, .ctc-search-animating").forEach((element) => {
        element.classList.remove("ctc-status-zone-active", "ctc-search-animating");
      });
    }
    this.registry.dispose();
  }
}

export function updateStatusBars(doc: Document, x: number, y: number): void {
  const enabled = doc.body.classList.contains("claude-auto-hide-status-bar") && isMotionEnabled(doc);
  doc.querySelectorAll<HTMLElement>(".status-bar").forEach((bar) => {
    if (!enabled) {
      bar.classList.remove("ctc-status-zone-active");
      return;
    }
    const rect = bar.getBoundingClientRect();
    const expanded = bar.classList.contains("ctc-status-zone-active") || rect.height > 10;
    const horizontalPadding = expanded ? 8 : 4;
    const topPadding = expanded ? 10 : 34;
    const bottomPadding = expanded ? 10 : 4;
    const inVirtualZone = x >= rect.left - horizontalPadding
      && x <= rect.right + horizontalPadding
      && y >= rect.top - topPadding
      && y <= rect.bottom + bottomPadding;
    bar.classList.toggle("ctc-status-zone-active", inVirtualZone);
  });
}
