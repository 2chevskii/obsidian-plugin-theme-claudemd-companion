import esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import process from "node:process";

const production = process.argv[2] === "production";
const outputDirectory = "dist";

const context = await esbuild.context({
  banner: { js: "/* Claude.md Theme Companion */" },
  entryPoints: {
    main: "src/main.ts",
    styles: "src/styles/styles.css"
  },
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outdir: outputDirectory,
  entryNames: "[name]",
  minify: production
});

async function copyManifest() {
  await mkdir(outputDirectory, { recursive: true });
  await copyFile("manifest.json", `${outputDirectory}/manifest.json`);
}

if (production) {
  await context.rebuild();
  await copyManifest();
  await context.dispose();
} else {
  await copyManifest();
  await context.watch();
}
