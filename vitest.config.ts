import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      obsidian: new URL("./src/obsidian.test-double.ts", import.meta.url).pathname
    },
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test-helpers.ts", "src/obsidian.test-double.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95
      }
    }
  }
});
