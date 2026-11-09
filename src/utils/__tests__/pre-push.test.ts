import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

const hookPath = fileURLToPath(new URL("../../../.husky/pre-push", import.meta.url))
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function runHook(lockfile: string) {
  const directory = mkdtempSync(join(tmpdir(), "read-buddy-pre-push-"))
  temporaryDirectories.push(directory)
  const bin = join(directory, "bin")
  mkdirSync(bin)
  mkdirSync(join(directory, "src"))
  writeFileSync(join(directory, "pnpm-lock.yaml"), lockfile)
  writeFileSync(join(bin, "pnpm"), [
    "#!/bin/sh",
    "if [ \"$1\" = exec ] && [ \"$2\" = node ]; then",
    "  shift 2",
    "  exec \"$READ_FROG_HOOK_TEST_NODE\" \"$@\"",
    "fi",
    "exit 0",
    "",
  ].join("\n"), { mode: 0o755 })

  return spawnSync("sh", ["-e", hookPath], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: bin + delimiter + (process.env.PATH ?? ""),
      READ_FROG_HOOK_TEST_NODE: process.execPath,
      SKIP_FREE_API: "true",
    },
  })
}

describe("pre-push dependency checks", () => {
  it("allows published version overrides and registry tarballs", () => {
    const result = runHook([
      "lockfileVersion: '9.0'",
      "overrides:",
      "  rollup@<4.59.0: ^4.68.1",
      "packages:",
      "  example@1.0.0:",
      "    resolution: {tarball: https://registry.npmjs.org/example/-/example-1.0.0.tgz}",
    ].join("\n"))

    expect(result.status).toBe(0)
  })

  it("rejects local links in dependency resolutions", () => {
    const result = runHook("importers:\n  .:\n    dependencies:\n      example:\n        version: link:../example\n")

    expect(result.status).toBe(1)
  })

  it.each([
    "file:../example",
    "'/Users/developer/example'",
    "../example",
    "'C:\\Users\\developer\\example'",
  ])("rejects local override %s", (reference) => {
    const result = runHook(`overrides:\n  example: ${reference}\n`)

    expect(result.status).toBe(1)
  })
})
