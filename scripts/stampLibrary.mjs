import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { digestCharacter } from "./libraryDigest.mjs";

/**
 * Stamps a content digest into every entry of the character library manifest,
 * so the app can tell that a published sheet changed under a device that
 * already loaded it.
 *
 * Two modes:
 *   node scripts/stampLibrary.mjs           writes the revisions back
 *   node scripts/stampLibrary.mjs --check   writes nothing, exits 1 if stale
 *
 * `--check` compares PARSED revision values, never regenerated file text: on
 * Windows the working tree is CRLF and `JSON.stringify` emits `\n`, so a text
 * comparison would always fail here and never on Vercel.
 *
 * The default mode runs as the first step of `npm run build`, rather than from a
 * `prebuild` hook, because `prebuild` only fires for `npm run build` and
 * Vercel's Build Command is a dashboard setting this repo cannot assert.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "public", "characters", "manifest.json");
const characterPath = (id) => join(root, "public", "characters", `${id}.json`);

const check = process.argv.includes("--check");

function readJson(path, what) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    fail(`Could not read ${what} at ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${what} at ${path} is not valid JSON: ${e.message}`);
  }
}

function fail(message) {
  console.error(`stampLibrary: ${message}`);
  process.exit(1);
}

const manifest = readJson(manifestPath, "the library manifest");
const entries = Array.isArray(manifest) ? manifest : manifest.characters;
if (!Array.isArray(entries)) {
  fail("the library manifest has no character list.");
}

const stale = [];
const changed = [];

for (const entry of entries) {
  if (!entry || typeof entry.id !== "string") {
    fail(`a manifest entry has no id: ${JSON.stringify(entry)}`);
  }
  const revision = digestCharacter(
    readJson(characterPath(entry.id), `character "${entry.id}"`),
  );
  if (entry.revision === revision) continue;
  if (check) {
    stale.push(
      `  ${entry.id}: manifest says ${entry.revision ?? "(none)"}, content is ${revision}`,
    );
  } else {
    changed.push(`  ${entry.id}: ${entry.revision ?? "(none)"} -> ${revision}`);
    entry.revision = revision;
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(
      `stampLibrary: the manifest is out of date.\n${stale.join("\n")}\n` +
        `Run \`npm run library:stamp\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log("stampLibrary: manifest is up to date.");
  process.exit(0);
}

if (changed.length === 0) {
  console.log("stampLibrary: nothing to do, manifest is up to date.");
  process.exit(0);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`stampLibrary: stamped ${changed.length} entr(ies).\n${changed.join("\n")}`);
