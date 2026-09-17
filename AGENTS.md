# Repository Guidelines

## Structure

`src/main.ts` contains the plugin source; `styles.css` supplies companion
styles. `main.js` is a generated production bundle and is not committed.
`manifest.json` and `versions.json` define Obsidian release compatibility.
Workflows are in `.github/workflows/`.

## Commands

Use Node.js 24, pinned in `package.json`.

- `npm ci` installs the locked dependencies.
- `npm run check` runs ESLint and strict TypeScript checks.
- `npm run build` validates types and writes the production `main.js` bundle.
- `npm run dev` watches the source and rebuilds during development.

## Style and Validation

Follow `.editorconfig`: UTF-8, LF, final newline, and two-space indentation.
Use `PascalCase` for types and classes, `camelCase` for functions and members,
and meaningful uppercase names for constants. Run `npm run check` and `npm run
build`; never commit the generated `main.js`.

## Releases

Keep the version in `package.json` and `manifest.json` identical. Add a
`versions.json` entry when the minimum supported Obsidian version changes. Push
a numeric tag matching the version. `release.yml` validates the tag, builds and
attests the assets, and publishes a release containing `main.js`,
`manifest.json`, and `styles.css`.

## Commits and Pull Requests

Use focused Conventional Commit-style subjects, for example `feat: animate
search results`. Describe behavior changes and validation in pull requests.
Include screenshots or recordings when UI behavior changes.
