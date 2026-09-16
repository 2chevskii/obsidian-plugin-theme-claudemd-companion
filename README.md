# Claude.md Theme Companion

Small motion and interaction refinements for the
[Claude.md](https://github.com/2chevskii/obsidian-theme-claudemd) Obsidian
theme.

[![Latest release](https://img.shields.io/github/v/release/2chevskii/obsidian-plugin-claude-theme-companion?color=c96442)](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/releases/latest)
[![Obsidian 1.10.6+](https://img.shields.io/badge/Obsidian-1.10.6%2B-7c3aed)](https://obsidian.md)
[![Build](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/actions/workflows/main.yml/badge.svg)](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/actions/workflows/main.yml)
[![MIT License](https://img.shields.io/github/license/2chevskii/obsidian-plugin-claude-theme-companion?color=c96442)](LICENSE)

[Install](#install) · [Features](#features) · [Contribute](#contribute) ·
[Report an issue](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/issues)

## Features

- Exit animations for dialogs, settings, and menus.
- Smooth transitions when search results change.
- Animated heading markers in Live Preview.
- A more forgiving activation area for the theme's auto-hidden status bar.
- Automatic reduced-motion support.

The plugin has no settings. Its enhancements activate only while Claude.md is
the active theme.

## Install

Requires **Obsidian 1.10.6 or newer** and the
[Claude.md theme](https://github.com/2chevskii/obsidian-theme-claudemd).

1. Open [Releases](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/releases)
   and download `main.js`, `manifest.json`, and `styles.css` from the latest
   release's **Assets**.
2. Create a `claude-theme-companion` folder inside your vault's
   `.obsidian/plugins/` directory and place all three files there:

   ```text
   Your vault/
   └── .obsidian/
       └── plugins/
           └── claude-theme-companion/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```

3. Reload Obsidian, then enable **Claude.md Theme Companion** under
   **Settings → Community plugins**.

If your vault uses a custom configuration folder, use that in place of
`.obsidian`. To update a manual installation, replace all three files with
those from the latest release.

## Contribute

Found a rough edge? [Open an issue](https://github.com/2chevskii/obsidian-plugin-claude-theme-companion/issues)
with reproduction steps, your Obsidian version, and a recording when the issue
involves motion. Pull requests are welcome too.

To work on the plugin, use **Node.js 24** and npm:

```sh
npm ci
npm run check
npm run build
```

Edit the TypeScript in [`src/`](src/) and companion rules in
[`styles.css`](styles.css). The production build writes `main.js`; it is a
generated release asset and is not committed.

## License & credits

Claude.md Theme Companion is released under the [MIT License](LICENSE).

Inspired by Claude. Not affiliated with or endorsed by Anthropic or Obsidian.
