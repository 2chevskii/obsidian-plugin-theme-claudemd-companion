// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("version CLI", () => {
  let root: string;
  let script: string;
  const initial = {
    "package.json": { name: "fixture", version: "1.2.3" },
    "manifest.json": { version: "1.2.3", minAppVersion: "1.10.6" },
    "versions.json": { "1.0.0": "1.9.0" },
    "package-lock.json": {
      version: "1.2.3", lockfileVersion: 3,
      packages: { "": { version: "1.2.3" }, dependency: { version: "9.0.0" } }
    }
  };
  const read = (name: string): unknown => JSON.parse(readFileSync(join(root, name), "utf8"));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "companion-version-"));
    mkdirSync(join(root, "tools"));
    script = join(root, "tools", "version.mjs");
    copyFileSync(new URL("../tools/version.mjs", import.meta.url), script);
    for (const [name, data] of Object.entries(initial)) {
      writeFileSync(join(root, name), `${JSON.stringify(data, null, 2)}\n`);
    }
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it.each([
    ["major", "2.0.0"], ["minor", "1.3.0"], ["patch", "1.2.4"]
  ])("bumps %s and preserves compatibility history", (command, expected) => {
    execFileSync(process.execPath, [script, command], { cwd: tmpdir() });
    expect(read("package.json")).toEqual({ name: "fixture", version: expected });
    expect(read("manifest.json")).toEqual({ version: expected, minAppVersion: "1.10.6" });
    expect(read("versions.json")).toEqual({ "1.0.0": "1.9.0", [expected]: "1.10.6" });
    expect(read("package-lock.json")).toEqual({
      version: expected, lockfileVersion: 3,
      packages: { "": { version: expected }, dependency: { version: "9.0.0" } }
    });
  });

  it.each([
    ["set", "3.2.1", "--compat", "1.11.0"],
    ["--compat", "1.11.0", "set", "3.2.1"]
  ])("sets an explicit version and compatibility with %j", (...args) => {
    execFileSync(process.execPath, [script, ...args]);
    expect(read("manifest.json")).toEqual({ version: "3.2.1", minAppVersion: "1.11.0" });
    expect(read("versions.json")).toEqual({ "1.0.0": "1.9.0", "3.2.1": "1.11.0" });
  });

  it("bumps with compatibility and tolerates an absent lockfile", () => {
    rmSync(join(root, "package-lock.json"));
    execFileSync(process.execPath, [script, "patch", "--compat", "1.11.0"]);
    expect(read("manifest.json")).toEqual({ version: "1.2.4", minAppVersion: "1.11.0" });
    expect(read("versions.json")).toEqual({ "1.0.0": "1.9.0", "1.2.4": "1.11.0" });
  });

  it("sets a version without changing the compatibility minimum", () => {
    execFileSync(process.execPath, [script, "set", "0.9.0"]);
    expect(read("manifest.json")).toEqual({ version: "0.9.0", minAppVersion: "1.10.6" });
    expect(read("versions.json")).toEqual({ "1.0.0": "1.9.0", "0.9.0": "1.10.6" });
  });

  it.each([
    [], ["unknown"], ["patch", "extra"], ["set"], ["set", "1.2"],
    ["set", "v1.2.3"], ["set", "01.2.3"], ["set", "1.2.3-beta"],
    ["patch", "--compat"], ["patch", "--compat", "bad"],
    ["patch", "--compat", "1.0.0", "--compat", "2.0.0"]
  ])("rejects invalid arguments without changing files: %j", (...args) => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toBe("");
    for (const [name, data] of Object.entries(initial)) expect(read(name)).toEqual(data);
  });

  it("validates all input files before writing", () => {
    writeFileSync(join(root, "versions.json"), "{broken");
    expect(spawnSync(process.execPath, [script, "patch"]).status).toBe(1);
    expect(read("package.json")).toEqual(initial["package.json"]);
    expect(read("manifest.json")).toEqual(initial["manifest.json"]);
    expect(read("package-lock.json")).toEqual(initial["package-lock.json"]);
  });
});
