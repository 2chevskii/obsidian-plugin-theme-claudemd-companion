import { afterEach, vi } from "vitest";

export function rect(left = 0, top = 0, width = 100, height = 20): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

export function setRect(element: Element, value: DOMRect): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);
}

export function enableMotion(doc: Document = document): void {
  doc.body.style.setProperty("--claude-surface-raised", "#fff");
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
}

export function installAnimationStubs(): { animate: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn();
  const animate = vi.fn();
  vi.stubGlobal("Animation", class { cancel = cancel; });
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ cancel }]
  });
  return { animate, cancel };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});
