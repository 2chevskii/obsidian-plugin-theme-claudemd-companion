# Claude Theme Companion

An optional Obsidian plugin that adds behavioral enhancements for the
Claude theme: exit animations, search-result transitions, live-preview heading
marker animation, and an activation zone for the auto-hidden status bar.

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the GitHub
   Release matching the plugin version.
2. Place them in `<vault>/.obsidian/plugins/claude-theme-companion/`.
3. Reload Obsidian and enable **Claude Theme Companion** under Community
   plugins.

The plugin is useful only with the Claude theme. It remains optional.

## Development

Use Node.js 24 (see `.nvmrc`).

```powershell
fnm use
npm ci
npm run check
npm run build
```

`npm run dev` watches and rebuilds `main.js`. Do not hand-edit the generated
bundle.

## Releases

Update `package.json`, `manifest.json`, and `versions.json`, then push a
numeric tag matching `manifest.json`, for example `1.0.0`. GitHub Actions
validates and builds the plugin, then creates a draft release with the files
required by Obsidian. Add release notes and publish that draft.

## License

Claude Theme Companion is available under the MIT License.
