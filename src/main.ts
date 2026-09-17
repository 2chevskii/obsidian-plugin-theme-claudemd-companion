import { Menu, Modal, Plugin, SuggestModal } from "obsidian";

import { AnimationRegistry } from "./animation-registry";
import { DocumentEffects } from "./document-effects";
import { ExitAnimator, resolveModalContainer } from "./exit-animations";
import { HeadingMarkerAnimator } from "./heading-marker-animations";
import { SearchAnimator } from "./search-animations";

type AnyMethod = (...args: unknown[]) => unknown;

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

interface MenuWithDom {
  dom?: HTMLElement;
}

export default class ClaudeThemeCompanion extends Plugin {
  private readonly patches: MethodPatch[] = [];
  private readonly registry = new AnimationRegistry();
  private readonly exitAnimator = new ExitAnimator(this.registry);
  private readonly searchAnimator = new SearchAnimator(this.registry);
  private readonly headingAnimator = new HeadingMarkerAnimator(this.registry);
  private readonly documentEffects = new DocumentEffects(
    this.registry,
    this.searchAnimator,
    this.headingAnimator,
    (cleanup) => this.register(cleanup)
  );

  onload(): void {
    this.patchMethod(Modal.prototype, "close", (instance) => {
      this.exitAnimator.animate(resolveModalContainer((instance as Modal).containerEl), "modal");
    });
    this.patchMethod(SuggestModal.prototype, "close", (instance) => {
      this.exitAnimator.animate(resolveModalContainer((instance as SuggestModal<unknown>).containerEl), "modal");
    });
    this.patchMethod(Menu.prototype, "hide", (instance) => {
      this.exitAnimator.animate((instance as MenuWithDom).dom ?? null, "menu");
    });
    this.patchMethod(Menu.prototype, "unload", (instance) => {
      this.exitAnimator.animate((instance as MenuWithDom).dom ?? null, "menu");
    });
    this.app.workspace.onLayoutReady(() => {
      this.patchSettingsCloseMethod();
      this.documentEffects.attach(document);
      this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
        this.documentEffects.attach(leaf.view.containerEl.ownerDocument);
      });
    });
    this.registerEvent(this.app.workspace.on("window-open", (workspaceWindow) => {
      this.documentEffects.attach(workspaceWindow.doc);
    }));
  }

  onunload(): void {
    this.restorePatches();
    this.documentEffects.clearTransientClasses(this.getOpenDocuments());
  }

  private patchSettingsCloseMethod(): void {
    const settings = (this.app as unknown as AppWithSettings).setting;
    if (!settings) return;
    this.patchMethod(settings, "close", (instance) => {
      const controller = instance as SettingsController;
      const fallback = document.querySelector<HTMLElement>(".modal.mod-settings")
        ?.closest<HTMLElement>(".modal-container") ?? null;
      this.exitAnimator.animate(resolveModalContainer(controller.containerEl) ?? fallback, "modal");
    });
  }

  private patchMethod(target: object, key: string, before: (instance: unknown) => void): void {
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

  private restorePatches(): void {
    while (this.patches.length) {
      const patch = this.patches.pop();
      if (patch && patch.target[patch.key] === patch.replacement) patch.target[patch.key] = patch.original;
    }
  }

  private getOpenDocuments(): Document[] {
    const documents = new Set<Document>([document]);
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      documents.add(leaf.view.containerEl.ownerDocument);
    });
    return [...documents];
  }
}
