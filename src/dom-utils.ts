import type { TextStyleSnapshot } from "./animation-types";
import { THEME_MARKER } from "./constants";

export function isClaudeTheme(doc: Document): boolean {
  return Boolean(doc.defaultView?.getComputedStyle(doc.body).getPropertyValue(THEME_MARKER).trim());
}

export function prefersReducedMotion(doc: Document): boolean {
  return doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function isMotionEnabled(doc: Document): boolean {
  return isClaudeTheme(doc) && !prefersReducedMotion(doc);
}

export function rectIntersects(rect: DOMRect, containerRect: DOMRect): boolean {
  return rect.bottom > containerRect.top
    && rect.top < containerRect.bottom
    && rect.right > containerRect.left
    && rect.left < containerRect.right;
}

export function removeDuplicateIds(root: HTMLElement): void {
  root.removeAttribute("id");
  root.querySelectorAll<HTMLElement>("[id]").forEach((element) => element.removeAttribute("id"));
}

export function copyScrollPositions(source: HTMLElement, clone: HTMLElement): void {
  const sourceElements = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const cloneElements = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  sourceElements.forEach((sourceElement, index) => {
    const cloneElement = cloneElements[index];
    if (!cloneElement) return;
    cloneElement.scrollTop = sourceElement.scrollTop;
    cloneElement.scrollLeft = sourceElement.scrollLeft;
  });
}

export function snapshotTextStyle(style: CSSStyleDeclaration): TextStyleSnapshot {
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight
  };
}
