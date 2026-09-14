import { Menu, Modal, Plugin, SuggestModal } from "obsidian";

type AnyMethod = (this: unknown, ...args: unknown[]) => unknown;
type ExitKind = "modal" | "menu";
type SearchKind = "prompt" | "settings";

interface MethodPatch {
  target: Record<string, unknown>;
  key: string;
  original: AnyMethod;
  replacement: AnyMethod;
}

interface SettingsController {
  containerEl?: HTMLElement;
  close: AnyMethod;
}

interface AppWithSettings {
  setting?: SettingsController;
}

interface SearchContext {
  container: HTMLElement;
  kind: SearchKind;
}

interface SearchItemSnapshot {
  clone: HTMLElement | null;
  key: string;
  rect: DOMRect;
  visible: boolean;
}

interface SearchSnapshot {
  items: SearchItemSnapshot[];
}

interface HeadingMarkerSnapshot {
  source: HTMLElement;
  line: HTMLElement | null;
  editorRoot: HTMLElement | null;
  contentText: string;
  contentRect: DOMRect | null;
  contentClone: HTMLElement | null;
  contentStyle: {
    color: string;
    fontFamily: string;
    fontSize: string;
    fontStyle: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
  } | null;
  clone: HTMLElement;
  rect: DOMRect;
  style: {
    color: string;
    fontFamily: string;
    fontSize: string;
    fontStyle: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
  };
}

const MODAL_EXIT_MS = 170;
const MENU_EXIT_MS = 125;
const SEARCH_MOVE_MS = 210;
const SEARCH_EXIT_MS = 145;
const HEADING_MARKER_EXIT_MS = 150;

export default class ClaudeThemeCompanion extends Plugin {
  private readonly patches: MethodPatch[] = [];
  private readonly closingElements = new WeakSet<HTMLElement>();
  private readonly attachedDocuments = new WeakSet<Document>();
  private readonly searchGenerations = new WeakMap<HTMLElement, number>();
  private readonly searchSnapshots = new WeakMap<HTMLElement, SearchSnapshot>();
  private readonly headingMarkerSnapshots = new WeakMap<Document, HeadingMarkerSnapshot[]>();
  private readonly cleanupTimers = new Set<number>();
  private readonly ghostElements = new Set<HTMLElement>();
  private readonly headingTitleLines = new Set<HTMLElement>();

  onload(): void {
    this.patchModalCloseMethods();
    this.patchMenuCloseMethods();
    this.app.workspace.onLayoutReady(() => {
      this.patchSettingsCloseMethod();
      this.attachDocument(document);
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        this.attachDocument(leaf.view.containerEl.ownerDocument);
      }
    });

    this.registerEvent(
      this.app.workspace.on("window-open", (workspaceWindow) => {
        this.attachDocument(workspaceWindow.doc);
      })
    );
  }

  onunload(): void {
    for (const patch of this.patches.reverse()) {
      if (patch.target[patch.key] === patch.replacement) {
        patch.target[patch.key] = patch.original;
      }
    }

    for (const timer of this.cleanupTimers) {
      window.clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    for (const ghost of this.ghostElements) {
      ghost.remove();
    }
    this.ghostElements.clear();

    for (const line of this.headingTitleLines) {
      line.classList.remove("ctc-heading-title-exiting");
    }
    this.headingTitleLines.clear();

    for (const doc of this.getOpenDocuments()) {
      doc.body.classList.remove("claude-theme-companion");
      doc.querySelectorAll(".ctc-status-zone-active").forEach((element) => {
        element.classList.remove("ctc-status-zone-active");
      });
      doc.querySelectorAll(".ctc-search-animating").forEach((element) => {
        element.classList.remove("ctc-search-animating");
      });
    }
  }

  private patchModalCloseMethods(): void {
    this.patchMethod(Modal.prototype, "close", (instance) => {
      this.animateModalExit(instance);
    });
    this.patchMethod(SuggestModal.prototype, "close", (instance) => {
      this.animateModalExit(instance);
    });
  }

  private patchMenuCloseMethods(): void {
    this.patchMethod(Menu.prototype, "hide", (instance) => {
      this.animateMenuExit(instance);
    });
    this.patchMethod(Menu.prototype, "unload", (instance) => {
      this.animateMenuExit(instance);
    });
  }

  private patchSettingsCloseMethod(): void {
    const setting = (this.app as unknown as AppWithSettings).setting;
    if (!setting) return;

    this.patchMethod(setting, "close", (instance) => {
      const controller = instance as SettingsController;
      const container = this.resolveModalContainer(controller.containerEl)
        ?? document.querySelector<HTMLElement>(".modal.mod-settings")?.closest<HTMLElement>(".modal-container");
      this.createExitGhost(container ?? null, "modal");
    });
  }

  private patchMethod(
    target: object,
    key: string,
    before: (instance: unknown) => void
  ): void {
    const record = target as Record<string, unknown>;
    const original = record[key];
    if (typeof original !== "function") return;

    const callable = original as AnyMethod;
    const replacement: AnyMethod = function (this: unknown, ...args: unknown[]) {
      before(this);
      return callable.apply(this, args);
    };

    record[key] = replacement;
    this.patches.push({ target: record, key, original: callable, replacement });
  }

  private animateModalExit(instance: unknown): void {
    const containerEl = (instance as { containerEl?: HTMLElement }).containerEl;
    this.createExitGhost(this.resolveModalContainer(containerEl), "modal");
  }

  private animateMenuExit(instance: unknown): void {
    const menuEl = (instance as { dom?: HTMLElement }).dom;
    this.createExitGhost(menuEl ?? null, "menu");
  }

  private resolveModalContainer(element?: HTMLElement): HTMLElement | null {
    if (!element) return null;
    return element.matches(".modal-container")
      ? element
      : element.closest<HTMLElement>(".modal-container");
  }

  private createExitGhost(source: HTMLElement | null, kind: ExitKind): void {
    if (
      !source
      || !source.isConnected
      || this.closingElements.has(source)
      || !this.isClaudeTheme(source.ownerDocument)
      || this.prefersReducedMotion(source.ownerDocument)
    ) {
      return;
    }

    this.closingElements.add(source);
    source.ownerDocument.defaultView?.queueMicrotask(() => {
      this.closingElements.delete(source);
    });
    const doc = source.ownerDocument;
    const rect = source.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.classList.add("ctc-exit-ghost", `ctc-${kind}-exit-ghost`);
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    this.removeDuplicateIds(ghost);
    this.copyScrollPositions(source, ghost);

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

    doc.body.appendChild(ghost);
    this.ghostElements.add(ghost);
    this.removeAfter(ghost, kind === "modal" ? MODAL_EXIT_MS : MENU_EXIT_MS);
  }

  private attachDocument(doc: Document): void {
    if (this.attachedDocuments.has(doc)) return;
    this.attachedDocuments.add(doc);
    doc.body.classList.add("claude-theme-companion");

    let pointerFrame = 0;
    let pointerX = -1;
    let pointerY = -1;

    const updateStatusBar = () => {
      pointerFrame = 0;
      this.updateStatusBars(doc, pointerX, pointerY);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) {
        pointerFrame = doc.defaultView?.requestAnimationFrame(updateStatusBar) ?? 0;
      }
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      pointerX = -1;
      pointerY = -1;
      this.updateStatusBars(doc, pointerX, pointerY);
    };

    const onInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof doc.defaultView!.HTMLInputElement)) return;
      const context = this.findSearchContext(input);
      if (!context || !this.isClaudeTheme(doc) || this.prefersReducedMotion(doc)) return;
      this.captureSearchSnapshot(context);
      this.scheduleSearchAnimation(context);
    };

    const captureHeadingMarkers = () => {
      this.captureHeadingMarkers(doc);
    };

    const headingObserver = new MutationObserver((records) => {
      const containsHeadingMarker = (node: Node) => (
        node.instanceOf(doc.defaultView!.HTMLElement)
        && (
          node.matches(".cm-formatting-header, .HyperMD-header")
          || Boolean(node.querySelector(".cm-formatting-header"))
        )
      );
      const removed = records.some((record) => (
        [...record.removedNodes].some(containsHeadingMarker)
      ));
      const added = records.some((record) => (
        [...record.addedNodes].some((node) => (
          node.instanceOf(doc.defaultView!.HTMLElement)
          && (
            node.matches(".cm-formatting-header, .HyperMD-header")
            || Boolean(node.querySelector(".cm-formatting-header"))
          )
        ))
      ));
      if (removed) this.flushHeadingMarkerExits(doc);
      if (added) {
        doc.defaultView?.requestAnimationFrame(() => {
          this.captureHeadingMarkers(doc);
        });
      }
    });
    headingObserver.observe(doc.body, { childList: true, subtree: true });

    doc.addEventListener("pointermove", onPointerMove, { passive: true });
    doc.addEventListener("pointerout", onPointerOut, { passive: true });
    doc.addEventListener("input", onInput, true);
    doc.addEventListener("pointerdown", captureHeadingMarkers, true);
    doc.addEventListener("keydown", captureHeadingMarkers, true);
    doc.addEventListener("focusout", captureHeadingMarkers, true);

    this.register(() => {
      if (pointerFrame) doc.defaultView?.cancelAnimationFrame(pointerFrame);
      doc.removeEventListener("pointermove", onPointerMove);
      doc.removeEventListener("pointerout", onPointerOut);
      doc.removeEventListener("input", onInput, true);
      doc.removeEventListener("pointerdown", captureHeadingMarkers, true);
      doc.removeEventListener("keydown", captureHeadingMarkers, true);
      doc.removeEventListener("focusout", captureHeadingMarkers, true);
      headingObserver.disconnect();
      doc.body.classList.remove("claude-theme-companion");
    });
  }

  private captureHeadingMarkers(doc: Document): void {
    if (!this.isClaudeTheme(doc) || this.prefersReducedMotion(doc)) return;
    const win = doc.defaultView;
    if (!win) return;

    const currentSnapshots = Array.from(
      doc.querySelectorAll<HTMLElement>(
        ".markdown-source-view.is-live-preview .HyperMD-header.cm-active > .cm-formatting-header"
      )
    ).map((source) => {
      const style = win.getComputedStyle(source);
      const line = source.closest<HTMLElement>(".HyperMD-header");
      const content = line?.querySelector<HTMLElement>(
        ":scope > .cm-header:not(.cm-formatting)"
      ) ?? null;
      const contentStyle = content ? win.getComputedStyle(content) : null;
      return {
        source,
        line,
        editorRoot: source.closest<HTMLElement>(".cm-content"),
        contentText: content?.textContent ?? "",
        contentRect: content?.getBoundingClientRect() ?? null,
        contentClone: content?.cloneNode(true) as HTMLElement | null,
        contentStyle: contentStyle ? {
          color: contentStyle.color,
          fontFamily: contentStyle.fontFamily,
          fontSize: contentStyle.fontSize,
          fontStyle: contentStyle.fontStyle,
          fontWeight: contentStyle.fontWeight,
          letterSpacing: contentStyle.letterSpacing,
          lineHeight: contentStyle.lineHeight
        } : null,
        clone: source.cloneNode(true) as HTMLElement,
        rect: source.getBoundingClientRect(),
        style: {
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontStyle: style.fontStyle,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight
        }
      };
    });

    const snapshots = this.headingMarkerSnapshots.get(doc) ?? [];
    for (const snapshot of currentSnapshots) {
      const existingIndex = snapshots.findIndex((existing) => existing.source === snapshot.source);
      if (existingIndex >= 0) {
        snapshots[existingIndex] = snapshot;
      } else {
        snapshots.push(snapshot);
      }
    }
    if (!snapshots.length) return;
    this.headingMarkerSnapshots.set(doc, snapshots);
  }

  private flushHeadingMarkerExits(doc: Document): void {
    const snapshots = this.headingMarkerSnapshots.get(doc);
    if (!snapshots?.length || !this.isClaudeTheme(doc) || this.prefersReducedMotion(doc)) return;

    const remaining: HeadingMarkerSnapshot[] = [];
    for (const snapshot of snapshots) {
      if (snapshot.source.isConnected) {
        remaining.push(snapshot);
        continue;
      }
      if (snapshot.line?.isConnected && snapshot.line.querySelector(".cm-formatting-header")) continue;
      if (snapshot.rect.width === 0 || snapshot.rect.height === 0) continue;

      let content = snapshot.line?.isConnected
        ? snapshot.line.querySelector<HTMLElement>(
          ":scope > .cm-header:not(.cm-formatting)"
        )
        : null;
      if (!content && snapshot.editorRoot?.isConnected && snapshot.contentRect) {
        const candidates = Array.from(
          snapshot.editorRoot.querySelectorAll<HTMLElement>(
            ".HyperMD-header > .cm-header:not(.cm-formatting)"
          )
        ).filter((candidate) => candidate.textContent === snapshot.contentText);
        content = candidates.sort((left, right) => (
          Math.abs(left.getBoundingClientRect().top - snapshot.contentRect!.top)
          - Math.abs(right.getBoundingClientRect().top - snapshot.contentRect!.top)
        ))[0] ?? null;
      }
      if (content && snapshot.contentRect) {
        const currentRect = content.getBoundingClientRect();
        const deltaX = currentRect.left - snapshot.contentRect.left;
        const titleGhost = snapshot.contentClone;
        const titleStyle = snapshot.contentStyle;
        const currentLine = content.closest<HTMLElement>(".HyperMD-header");
        if (titleGhost && titleStyle && currentLine && Math.abs(deltaX) >= 0.5) {
          this.removeDuplicateIds(titleGhost);
          titleGhost.classList.add("ctc-heading-title-exit");
          titleGhost.setAttribute("aria-hidden", "true");
          titleGhost.setAttribute("contenteditable", "false");
          Object.assign(titleGhost.style, {
            position: "fixed",
            inset: "auto",
            left: `${snapshot.contentRect.left}px`,
            top: `${snapshot.contentRect.top}px`,
            width: `${snapshot.contentRect.width}px`,
            height: `${snapshot.contentRect.height}px`,
            margin: "0",
            color: titleStyle.color,
            fontFamily: titleStyle.fontFamily,
            fontSize: titleStyle.fontSize,
            fontStyle: titleStyle.fontStyle,
            fontWeight: titleStyle.fontWeight,
            letterSpacing: titleStyle.letterSpacing,
            lineHeight: `${snapshot.contentRect.height}px`,
            pointerEvents: "none",
            zIndex: "99999"
          });
          currentLine.classList.add("ctc-heading-title-exiting");
          this.headingTitleLines.add(currentLine);
          doc.body.appendChild(titleGhost);
          this.ghostElements.add(titleGhost);
          titleGhost.animate(
            [
              { transform: "translateX(0)" },
              { transform: `translateX(${deltaX}px)` }
            ],
            {
              duration: HEADING_MARKER_EXIT_MS,
              easing: "cubic-bezier(0.34, 0.55, 0.25, 1.08)",
              fill: "both"
            }
          );
          const win = doc.defaultView ?? window;
          const timer = win.setTimeout(() => {
            currentLine.classList.remove("ctc-heading-title-exiting");
            this.headingTitleLines.delete(currentLine);
            titleGhost.remove();
            this.ghostElements.delete(titleGhost);
            this.cleanupTimers.delete(timer);
          }, HEADING_MARKER_EXIT_MS);
          this.cleanupTimers.add(timer);
        }
      }

      const ghost = snapshot.clone;
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
        color: snapshot.style.color,
        fontFamily: snapshot.style.fontFamily,
        fontSize: snapshot.style.fontSize,
        fontStyle: snapshot.style.fontStyle,
        fontWeight: snapshot.style.fontWeight,
        letterSpacing: snapshot.style.letterSpacing,
        lineHeight: snapshot.style.lineHeight,
        pointerEvents: "none",
        zIndex: "99999"
      });
      doc.body.appendChild(ghost);
      this.ghostElements.add(ghost);
      this.removeAfter(ghost, HEADING_MARKER_EXIT_MS);
    }

    if (remaining.length) {
      this.headingMarkerSnapshots.set(doc, remaining);
    } else {
      this.headingMarkerSnapshots.delete(doc);
    }
  }

  private updateStatusBars(doc: Document, x: number, y: number): void {
    const enabled = doc.body.classList.contains("claude-auto-hide-status-bar")
      && this.isClaudeTheme(doc);

    for (const bar of doc.querySelectorAll<HTMLElement>(".status-bar")) {
      if (!enabled) {
        bar.classList.remove("ctc-status-zone-active");
        continue;
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
    }
  }

  private findSearchContext(input: HTMLInputElement): SearchContext | null {
    if (input.matches(".prompt-input")) {
      const container = input.closest(".prompt")?.querySelector<HTMLElement>(".prompt-results");
      if (!container) return null;
      return {
        container,
        kind: "prompt"
      };
    }

    if (input.matches(".modal.mod-settings .setting-search-container input[type='search']")) {
      const container = input.closest(".modal.mod-settings")
        ?.querySelector<HTMLElement>(".setting-search-results");
      if (!container) return null;
      return {
        container,
        kind: "settings"
      };
    }

    return null;
  }

  private scheduleSearchAnimation(context: SearchContext): void {
    const generation = (this.searchGenerations.get(context.container) ?? 0) + 1;
    this.searchGenerations.set(context.container, generation);
    const win = context.container.ownerDocument.defaultView;
    if (!win) return;

    if (context.kind === "settings") {
      const timer = win.setTimeout(() => {
        this.cleanupTimers.delete(timer);
        if (this.searchGenerations.get(context.container) !== generation) return;
        this.animateSearchChanges(context);
      }, 70);
      this.cleanupTimers.add(timer);
      return;
    }

    win.requestAnimationFrame(() => {
      if (this.searchGenerations.get(context.container) !== generation) return;
      this.animateSearchChanges(context);
    });
  }

  private animateSearchChanges(context: SearchContext): void {
    if (!context.container.isConnected) return;
    const snapshot = this.searchSnapshots.get(context.container);
    if (!snapshot) return;

    this.searchSnapshots.delete(context.container);
    const currentItems = this.getSearchItems(context);
    const previousByKey = new Map(snapshot.items.map((item) => [item.key, item]));
    const currentKeys = this.getSearchItemKeys(currentItems, context.kind);
    const retainedKeys = new Set(currentKeys);
    const doc = context.container.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const containerRect = context.container.getBoundingClientRect();

    context.container.classList.add("ctc-search-animating");

    currentItems.forEach((item, index) => {
      for (const animation of item.getAnimations()) animation.cancel();
      const previous = previousByKey.get(currentKeys[index]);
      const currentRect = item.getBoundingClientRect();
      const currentVisible = this.rectIntersects(currentRect, containerRect);

      if (previous) {
        if (!previous.visible && !currentVisible) return;
        const deltaX = previous.rect.left - currentRect.left;
        const deltaY = previous.rect.top - currentRect.top;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

        item.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" }
          ],
          {
            duration: SEARCH_MOVE_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
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
      this.removeDuplicateIds(clone);
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
      this.ghostElements.add(clone);
      clone.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
          { opacity: 0, transform: "translateY(-5px) scale(0.985)", filter: "blur(2px)" }
        ],
        {
          duration: SEARCH_EXIT_MS,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards"
        }
      );
      this.removeAfter(clone, SEARCH_EXIT_MS);
    }

    const timer = win.setTimeout(() => {
      this.cleanupTimers.delete(timer);
      if (!context.container.querySelector(".ctc-search-exit-item")) {
        context.container.classList.remove("ctc-search-animating");
      }
    }, SEARCH_MOVE_MS + 50);
    this.cleanupTimers.add(timer);
  }

  private captureSearchSnapshot(context: SearchContext): void {
    const items = this.getSearchItems(context);
    const keys = this.getSearchItemKeys(items, context.kind);
    const containerRect = context.container.getBoundingClientRect();
    this.searchSnapshots.set(context.container, {
      items: items.map((item, index) => {
        const rect = item.getBoundingClientRect();
        const visible = this.rectIntersects(rect, containerRect);
        return {
          clone: visible ? item.cloneNode(true) as HTMLElement : null,
          key: keys[index],
          rect,
          visible
        };
      })
    });

    for (const item of items) {
      for (const animation of item.getAnimations()) animation.cancel();
    }
  }

  private getSearchItems(context: SearchContext): HTMLElement[] {
    const selector = context.kind === "prompt"
      ? ":scope > .suggestion-item:not(.ctc-search-exit-item)"
      : ":scope > .setting-search-result-group:not(.ctc-search-exit-item)";
    return Array.from(context.container.querySelectorAll<HTMLElement>(selector));
  }

  private getSearchItemKeys(items: HTMLElement[], kind: SearchKind): string[] {
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

  private rectIntersects(rect: DOMRect, containerRect: DOMRect): boolean {
    return rect.bottom > containerRect.top
      && rect.top < containerRect.bottom
      && rect.right > containerRect.left
      && rect.left < containerRect.right;
  }

  private removeAfter(element: HTMLElement, duration: number): void {
    const win = element.ownerDocument.defaultView ?? window;
    const timer = win.setTimeout(() => {
      element.remove();
      this.ghostElements.delete(element);
      this.cleanupTimers.delete(timer);
    }, duration + 50);
    this.cleanupTimers.add(timer);
  }

  private removeDuplicateIds(root: HTMLElement): void {
    root.removeAttribute("id");
    root.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
      element.removeAttribute("id");
    });
  }

  private copyScrollPositions(source: HTMLElement, clone: HTMLElement): void {
    const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
    for (let index = 0; index < sourceElements.length; index += 1) {
      const sourceElement = sourceElements[index];
      const cloneElement = cloneElements[index];
      if (!sourceElement || !cloneElement) continue;
      cloneElement.scrollTop = sourceElement.scrollTop;
      cloneElement.scrollLeft = sourceElement.scrollLeft;
    }
  }

  private prefersReducedMotion(doc: Document): boolean {
    return doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  private isClaudeTheme(doc: Document): boolean {
    return Boolean(
      doc.defaultView
        ?.getComputedStyle(doc.body)
        .getPropertyValue("--claude-surface-raised")
        .trim()
    );
  }

  private getOpenDocuments(): Document[] {
    const documents = new Set<Document>([document]);
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      documents.add(leaf.view.containerEl.ownerDocument);
    }
    return Array.from(documents);
  }
}
