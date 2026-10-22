# Contributing

## Local checks

Use Node.js 24 and install the exact dependency graph from `package-lock.json`.

```powershell
fnm use
npm ci
npm run check
npm run build
```

Test behavioral changes in Obsidian with Claude.md active. Check reduced-motion
behavior and include a recording when a pull request changes visible motion.

## Versioning

Use the version script to update `package.json`, `manifest.json`, the lockfile,
and the compatibility mapping in `versions.json` together:

```sh
node tools/version.mjs patch
node tools/version.mjs minor
node tools/version.mjs major
node tools/version.mjs set 2.0.0 --compat 1.11.0
```

Versions must use numeric `X.Y.Z` format. Without `--compat`, the script keeps
the current `manifest.json.minAppVersion`. With it, the script updates that
minimum and writes `"<plugin version>": "<compat version>"` in `versions.json`.
Existing compatibility entries are preserved. The script works from any
working directory and does not create commits or tags.

## Release checklist

1. Run checks and the production build locally.
2. Verify `main.js`, `manifest.json`, and `styles.css` together in Obsidian.
3. Push a numeric tag matching `manifest.json`.
4. Verify that GitHub Actions published a release with all three assets and a
   provenance attestation.
