export type ExitKind = "modal" | "menu";
export type SearchKind = "prompt" | "settings";

export interface SearchContext {
  container: HTMLElement;
  kind: SearchKind;
}

export interface SearchItemSnapshot {
  clone: HTMLElement | null;
  key: string;
  rect: DOMRect;
  visible: boolean;
}

export interface SearchSnapshot {
  items: SearchItemSnapshot[];
}

export interface TextStyleSnapshot {
  color: string;
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
}

export interface HeadingMarkerSnapshot {
  source: HTMLElement;
  line: HTMLElement | null;
  editorRoot: HTMLElement | null;
  contentText: string;
  contentRect: DOMRect | null;
  contentClone: HTMLElement | null;
  contentStyle: TextStyleSnapshot | null;
  clone: HTMLElement;
  rect: DOMRect;
  style: TextStyleSnapshot;
}
