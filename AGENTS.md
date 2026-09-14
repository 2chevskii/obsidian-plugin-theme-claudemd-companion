# Repository Guidelines

## Structure

`src/main.ts` contains the plugin source; `styles.css` supplies companion
styles. `main.js` is a committed production bundle. `manifest.json` and
`versions.json` define Obsidian release compatibility. Workflows are in
`.github/workflows/`.

## Commands

Use Node.js 24 via `.nvmrc`.

- `npm ci` installs the locked dependencies.
- `npm run check` runs ESLint and strict TypeScript checks.
- `npm run build` validates types and writes the production `main.js` bundle.
- `npm run dev` watches the source and rebuilds during development.

## Style and Validation

Follow `.editorconfig`: UTF-8, LF, final newline, and two-space indentation.
Use `PascalCase` for types and classes, `camelCase` for functions and members,
and meaningful uppercase names for constants. Run `npm run check` and `npm run
build`; commit `main.js` only when it matches the source.

## Releases

Keep the version in `package.json` and `manifest.json` identical, and add the
same version to `versions.json`. Push a numeric tag matching that version.
`start_release.yml` creates a draft release containing `main.js`,
`manifest.json`, and `styles.css`; review its notes and publish it manually.

## Commits and Pull Requests

Use focused Conventional Commit-style subjects, for example `feat: animate
search results`. Describe behavior changes and validation in pull requests.
Include screenshots or recordings when UI behavior changes.
