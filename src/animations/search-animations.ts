import type { SearchContext, SearchKind, SearchSnapshot } from "./animation-types";
import { AnimationRegistry } from "./animation-registry";
import { SEARCH_EXIT_MS, SEARCH_MOVE_MS } from "./constants";
import { rectIntersects, removeDuplicateIds } from "../dom/dom-utils";

export class SearchAnimator {
  private readonly generations = new WeakMap<HTMLElement, number>();
  private readonly snapshots = new WeakMap<HTMLElement, SearchSnapshot>();

  constructor(private readonly registry: AnimationRegistry) {}

  capture(context: SearchContext): void {
    const items = getSearchItems(context);
    const keys = getSearchItemKeys(items, context.kind);
    const containerRect = context.container.getBoundingClientRect();
    this.snapshots.set(context.container, {
      items: items.map((item, index) => {
        const rect = item.getBoundingClientRect();
        return {
          clone: rectIntersects(rect, containerRect) ? item.cloneNode(true) as HTMLElement : null,
          key: keys[index],
          rect,
          visible: rectIntersects(rect, containerRect)
        };
      })
    });
    items.forEach(cancelAnimations);
  }

  schedule(context: SearchContext): void {
    const generation = (this.generations.get(context.container) ?? 0) + 1;
    this.generations.set(context.container, generation);
    const win = context.container.ownerDocument.defaultView;
    if (!win) return;

    if (context.kind === "settings") {
      const timer = win.setTimeout(() => {
        this.registry.forgetTimer(timer);
        if (this.generations.get(context.container) === generation) this.animateChanges(context);
      }, 70);
      this.registry.trackTimer(timer);
      return;
    }

    win.requestAnimationFrame(() => {
      if (this.generations.get(context.container) === generation) this.animateChanges(context);
    });
  }

  animateChanges(context: SearchContext): void {
    if (!context.container.isConnected) return;
    const snapshot = this.snapshots.get(context.container);
    if (!snapshot) return;
    this.snapshots.delete(context.container);

    const currentItems = getSearchItems(context);
    const previousByKey = new Map(snapshot.items.map((item) => [item.key, item]));
    const currentKeys = getSearchItemKeys(currentItems, context.kind);
    const retainedKeys = new Set(currentKeys);
    const doc = context.container.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const containerRect = context.container.getBoundingClientRect();
    context.container.classList.add("ctc-search-animating");

    currentItems.forEach((item, index) => {
      cancelAnimations(item);
      const previous = previousByKey.get(currentKeys[index]);
      const currentRect = item.getBoundingClientRect();
      const currentVisible = rectIntersects(currentRect, containerRect);
      if (previous) {
        if ((!previous.visible && !currentVisible)
          || (Math.abs(previous.rect.left - currentRect.left) < 0.5
            && Math.abs(previous.rect.top - currentRect.top) < 0.5)) {
          return;
        }
        item.animate(
          [
            { transform: `translate(${previous.rect.left - currentRect.left}px, ${previous.rect.top - currentRect.top}px)` },
            { transform: "translate(0, 0)" }
          ],
          { duration: SEARCH_MOVE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
        return;
      }
      if (!currentVisible) return;
      item.animate(
        [
          { opacity: 0, transform: "translateY(7px) scale(0.99)", filter: "blur(1.5px)" },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" }
        ],
        {
          duration: SEARCH_MOVE_MS,
          delay: Math.min(index * 4, 28),
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "backwards"
        }
      );
    });

    for (const previous of snapshot.items) {
      if (retainedKeys.has(previous.key) || !previous.clone) continue;
      const clone = previous.clone;
      clone.classList.add("ctc-search-exit-item");
      clone.setAttribute("aria-hidden", "true");
      clone.inert = true;
      removeDuplicateIds(clone);
      Object.assign(clone.style, {
        position: "absolute",
        inset: "auto",
        left: `${previous.rect.left - containerRect.left + context.container.scrollLeft}px`,
        top: `${previous.rect.top - containerRect.top + context.container.scrollTop}px`,
        width: `${previous.rect.width}px`,
        height: `${previous.rect.height}px`,
        margin: "0",
        pointerEvents: "none",
        zIndex: "2"
      });
      context.container.appendChild(clone);
      this.registry.trackGhost(clone);
      clone.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
          { opacity: 0, transform: "translateY(-5px) scale(0.985)", filter: "blur(2px)" }
        ],
        { duration: SEARCH_EXIT_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
      );
      this.registry.removeAfter(clone, SEARCH_EXIT_MS);
    }

    const timer = win.setTimeout(() => {
      this.registry.forgetTimer(timer);
      if (!context.container.querySelector(".ctc-search-exit-item")) {
        context.container.classList.remove("ctc-search-animating");
      }
    }, SEARCH_MOVE_MS + 50);
    this.registry.trackTimer(timer);
  }
}

export function findSearchContext(input: HTMLInputElement): SearchContext | null {
  if (input.matches(".prompt-input")) {
    const container = input.closest(".prompt")?.querySelector<HTMLElement>(".prompt-results");
    return container ? { container, kind: "prompt" } : null;
  }
  if (input.matches(".modal.mod-settings .setting-search-container input[type='search']")) {
    const container = input.closest(".modal.mod-settings")?.querySelector<HTMLElement>(".setting-search-results");
    return container ? { container, kind: "settings" } : null;
  }
  return null;
}

export function getSearchItems(context: SearchContext): HTMLElement[] {
  const selector = context.kind === "prompt"
    ? ":scope > .suggestion-item:not(.ctc-search-exit-item)"
    : ":scope > .setting-search-result-group:not(.ctc-search-exit-item)";
  return Array.from(context.container.querySelectorAll<HTMLElement>(selector));
}

export function getSearchItemKeys(items: HTMLElement[], kind: SearchKind): string[] {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const baseKey = item.dataset.path
      ?? item.dataset.value
      ?? item.getAttribute("aria-label")
      ?? item.textContent?.replace(/\s+/g, " ").trim()
      ?? `${kind}-item`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return `${kind}:${baseKey}:${occurrence}`;
  });
}

function cancelAnimations(element: HTMLElement): void {
  element.getAnimations().forEach((animation) => animation.cancel());
}
