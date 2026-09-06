import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { digestCharacter } from "./libraryDigest.mjs";

/**
 * Stamps a content digest into every entry of the character library manifest,
 * so the app can tell that a published sheet changed under a device that
 * already loaded it.
 *
 * It also re-derives the entry's display fields (`name`, `className`, `level`)
 * from the sheet, because those are what the library picker renders. They used
 * to be hand-written, and a level-up would leave the picker offering
 * "Bard (Lore) · Level 5" for a sheet that had already moved on.
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

/** What the library picker shows for a sheet: "Wizard (Illusionist)". */
function displayClass(character) {
  return character.subclass
    ? `${character.className} (${character.subclass})`
    : character.className;
}

for (const entry of entries) {
  if (!entry || typeof entry.id !== "string") {
    fail(`a manifest entry has no id: ${JSON.stringify(entry)}`);
  }
  const character = readJson(characterPath(entry.id), `character "${entry.id}"`);
  const derived = {
    name: character.name,
    className: displayClass(character),
    level: character.level,
    revision: digestCharacter(character),
  };

  for (const [field, value] of Object.entries(derived)) {
    if (entry[field] === value) continue;
    const was = entry[field] ?? "(none)";
    if (check) {
      stale.push(`  ${entry.id}.${field}: manifest says ${was}, content is ${value}`);
    } else {
      changed.push(`  ${entry.id}.${field}: ${was} -> ${value}`);
      entry[field] = value;
    }
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
console.log(`stampLibrary: stamped ${changed.length} field(s).\n${changed.join("\n")}`);
