import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      obsidian: new URL("./tests/obsidian.test-double.ts", import.meta.url).pathname
    },
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["tests/**"],
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
