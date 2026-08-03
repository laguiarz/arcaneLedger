import { describe, it, expect, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchLibraryManifest } from "./characterLibrary";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function stubManifest(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => body })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The manifest's revisions are what tell a device its sheet was republished. If
 * they drift from the character files the notice silently stops working, so the
 * stamp script's own --check is the guard.
 *
 * Shelling out rather than importing: the script is plain ESM under scripts/,
 * which is outside tsconfig's `include`, and `npm run build` runs `tsc -b` over
 * the tests — importing it would take the production build down. `process.execPath`
 * and no shell keeps this working on Windows.
 */
describe("the committed library manifest", () => {
  it("is stamped with the current character revisions", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/stampLibrary.mjs", "--check"], {
        cwd: repoRoot,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});

describe("fetchLibraryManifest", () => {
  it("keeps the revision on each entry", async () => {
    stubManifest({
      version: 1,
      characters: [{ id: "brunella", name: "Brunella", revision: "abc123" }],
    });
    const entries = await fetchLibraryManifest();
    expect(entries[0].revision).toBe("abc123");
  });

  it("tolerates an entry with no revision", async () => {
    stubManifest({
      version: 1,
      characters: [{ id: "lyari", name: "Lyari" }],
    });
    const entries = await fetchLibraryManifest();
    expect(entries).toHaveLength(1);
    expect(entries[0].revision).toBeUndefined();
  });

  it("tolerates a bare array with no envelope", async () => {
    stubManifest([{ id: "lyari", name: "Lyari", revision: "zzz" }]);
    const entries = await fetchLibraryManifest();
    expect(entries[0].revision).toBe("zzz");
  });
});
