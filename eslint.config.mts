import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "coverage",
    "dist",
    "esbuild.config.mjs",
    "versions.json",
    "main.js",
    "package.json",
    "package-lock.json",
    "tsconfig.json"
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts", "manifest.json", "vitest.config.ts"]
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"]
      }
    }
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.test.ts", "src/test-helpers.ts", "src/obsidian.test-double.ts"],
    rules: {
      "@microsoft/sdl/no-inner-html": "off",
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
      "obsidianmd/no-static-styles-assignment": "off",
      "obsidianmd/prefer-create-el": "off"
    }
  }
);
