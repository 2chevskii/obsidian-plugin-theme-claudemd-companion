import type { ExitKind } from "./animation-types";
import { AnimationRegistry } from "./animation-registry";
import { MENU_EXIT_MS, MODAL_EXIT_MS } from "./constants";
import {
  copyScrollPositions,
  isMotionEnabled,
  removeDuplicateIds
} from "../dom/dom-utils";

export class ExitAnimator {
  private readonly closingElements = new WeakSet<HTMLElement>();

  constructor(private readonly registry: AnimationRegistry) {}

  animate(source: HTMLElement | null, kind: ExitKind): void {
    if (!source || !source.isConnected || this.closingElements.has(source) || !isMotionEnabled(source.ownerDocument)) {
      return;
    }

    const rect = source.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.closingElements.add(source);
    source.ownerDocument.defaultView?.queueMicrotask(() => this.closingElements.delete(source));

    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.classList.add("ctc-exit-ghost", `ctc-${kind}-exit-ghost`);
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    removeDuplicateIds(ghost);
    copyScrollPositions(source, ghost);
    Object.assign(ghost.style, {
      position: "fixed",
      inset: "auto",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "99999"
    });

    source.ownerDocument.body.appendChild(ghost);
    this.registry.trackGhost(ghost);
    this.registry.removeAfter(ghost, kind === "modal" ? MODAL_EXIT_MS : MENU_EXIT_MS);
  }
}

export function resolveModalContainer(element?: HTMLElement): HTMLElement | null {
  if (!element) return null;
  return element.matches(".modal-container")
    ? element
    : element.closest<HTMLElement>(".modal-container");
}
