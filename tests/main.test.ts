import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class Plugin {
    app: unknown;

    constructor(app: unknown) {
      this.app = app;
    }

    register(callback: () => void): void {
      void callback;
    }

    registerEvent(): void {}
  }
  class Modal {
    containerEl?: HTMLElement;

    close(): void {}
  }
  class SuggestModal<T> extends Modal {
    declare item: T;
  }
  class Menu {
    hide(): void {}
    unload(): void {}
  }
  return { Plugin, Modal, SuggestModal, Menu };
});

import { Menu, Modal, SuggestModal } from "obsidian";

import ClaudeThemeCompanion from "../src/main";
import { enableMotion, rect, setRect } from "./test-helpers";

describe("ClaudeThemeCompanion", () => {
  it("patches lifecycle methods, attaches documents, and restores all state on unload", () => {
    enableMotion();
    const modalClose = vi.fn();
    const suggestClose = vi.fn();
    const menuHide = vi.fn();
    const menuUnload = vi.fn();
    Modal.prototype.close = modalClose;
    SuggestModal.prototype.close = suggestClose;
    Menu.prototype.hide = menuHide;
    Menu.prototype.unload = menuUnload;
    const settingsClose = vi.fn();
    const layoutReady = vi.fn();
    const windowOpen = vi.fn();
    const app = {
      setting: { close: settingsClose },
      workspace: {
        onLayoutReady: (callback: () => void) => layoutReady.mockImplementation(callback),
        on: (_name: string, callback: (window: { doc: Document }) => void) => windowOpen.mockImplementation(callback),
        getLeavesOfType: () => [{ view: { containerEl: document.body } }]
      }
    };
    const plugin = new ClaudeThemeCompanion(app as never, {} as never);
    plugin.onload();
    layoutReady();
    expect(document.body.classList.contains("claude-theme-companion")).toBe(true);
    expect(windowOpen).toHaveBeenCalledTimes(0);

    const container = document.createElement("div");
    container.className = "modal-container";
    document.body.append(container);
    setRect(container, rect());
    (Modal.prototype.close as () => void).call({ containerEl: container });
    (SuggestModal.prototype.close as () => void).call({ containerEl: container });
    (Menu.prototype.hide as () => void).call({ dom: container });
    (Menu.prototype.unload as () => void).call({ dom: container });
    (Menu.prototype.hide as () => void).call({});
    (Menu.prototype.unload as () => void).call({});
    (app.setting.close as () => void).call({ containerEl: container });
    expect(modalClose).toHaveBeenCalledTimes(1);
    expect(suggestClose).toHaveBeenCalledTimes(1);
    expect(menuHide).toHaveBeenCalledTimes(2);
    expect(menuUnload).toHaveBeenCalledTimes(2);
    expect(settingsClose).toHaveBeenCalledTimes(1);

    plugin.onunload();
    expect(Modal.prototype.close).toBe(modalClose);
    expect(SuggestModal.prototype.close).toBe(suggestClose);
    expect(Menu.prototype.hide).toBe(menuHide);
    expect(Menu.prototype.unload).toBe(menuUnload);
    expect(app.setting.close).toBe(settingsClose);
    expect(document.body.classList.contains("claude-theme-companion")).toBe(false);
  });

  it("works when settings are unavailable and attaches a newly opened window", () => {
    const layoutReady = vi.fn();
    const windowOpen = vi.fn();
    const app = {
      workspace: {
        onLayoutReady: (callback: () => void) => layoutReady.mockImplementation(callback),
        on: (_name: string, callback: (window: { doc: Document }) => void) => windowOpen.mockImplementation(callback),
        getLeavesOfType: () => []
      }
    };
    const plugin = new ClaudeThemeCompanion(app as never, {} as never);
    plugin.onload();
    layoutReady();
    const openedDocument = document.implementation.createHTMLDocument("opened");
    windowOpen({ doc: openedDocument });
    expect(openedDocument.body.classList.contains("claude-theme-companion")).toBe(true);
    plugin.onunload();
  });

  it("uses the settings fallback and leaves externally replaced patches intact", () => {
    enableMotion();
    const layoutReady = vi.fn();
    const settingsClose = vi.fn();
    const app = {
      setting: { close: settingsClose },
      workspace: {
        onLayoutReady: (callback: () => void) => layoutReady.mockImplementation(callback),
        on: vi.fn(),
        getLeavesOfType: () => []
      }
    };
    const fallback = document.createElement("div");
    fallback.className = "modal-container";
    fallback.innerHTML = '<div class="modal mod-settings"></div>';
    document.body.append(fallback);
    setRect(fallback, rect());
    const plugin = new ClaudeThemeCompanion(app as never, {} as never);
    plugin.onload();
    layoutReady();
    (app.setting.close as () => void).call({});
    expect(document.querySelector(".ctc-modal-exit-ghost")).not.toBeNull();
    const replacement = vi.fn();
    Menu.prototype.hide = replacement;
    plugin.onunload();
    expect(Menu.prototype.hide).toBe(replacement);
  });
});
