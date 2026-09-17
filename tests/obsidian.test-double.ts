export class Plugin {
  app: unknown;

  constructor(app: unknown) {
    this.app = app;
  }

  register(): void {}

  registerEvent(): void {}
}

export class Modal {
  containerEl?: HTMLElement;

  close(): void {}
}

export class SuggestModal<T> extends Modal {
  declare item: T;
}

export class Menu {
  hide(): void {}
  unload(): void {}
}
