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

For each release, update `package.json` and `manifest.json` to the same Semantic
Versioning value. Add a `versions.json` entry when the minimum supported
Obsidian version changes.

## Release checklist

1. Run checks and the production build locally.
2. Verify `main.js`, `manifest.json`, and `styles.css` together in Obsidian.
3. Push a numeric tag matching `manifest.json`.
4. Verify that GitHub Actions published a release with all three assets and a
   provenance attestation.
