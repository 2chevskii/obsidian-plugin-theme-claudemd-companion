export class AnimationRegistry {
  private readonly timers = new Set<number>();
  private readonly ghosts = new Set<HTMLElement>();
  private readonly headingTitleLines = new Set<HTMLElement>();

  trackTimer(timer: number): void {
    this.timers.add(timer);
  }

  forgetTimer(timer: number): void {
    this.timers.delete(timer);
  }

  trackGhost(element: HTMLElement): void {
    this.ghosts.add(element);
  }

  forgetGhost(element: HTMLElement): void {
    this.ghosts.delete(element);
  }

  trackHeadingTitleLine(line: HTMLElement): void {
    this.headingTitleLines.add(line);
  }

  forgetHeadingTitleLine(line: HTMLElement): void {
    this.headingTitleLines.delete(line);
  }

  removeAfter(element: HTMLElement, duration: number): void {
    const win = element.ownerDocument.defaultView ?? window;
    const timer = win.setTimeout(() => {
      element.remove();
      this.forgetGhost(element);
      this.forgetTimer(timer);
    }, duration + 50);
    this.trackTimer(timer);
  }

  dispose(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    for (const ghost of this.ghosts) ghost.remove();
    this.ghosts.clear();
    for (const line of this.headingTitleLines) line.classList.remove("ctc-heading-title-exiting");
    this.headingTitleLines.clear();
  }
}
