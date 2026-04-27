import type {
  Ability,
  Cantrip,
  Character,
  Resource,
  Spell,
  SpellLevel,
  SpellSchool,
  SpellSlots,
  SpellSource,
} from "@/types/character";
import { FEAT_REGISTRY, normalizeFeatName } from "./featRegistry";
import {
  SUBCLASS_REGISTRY,
  subclassRegistryKey,
  type SchoolModifier,
  type StripComponent,
} from "./subclassRegistry";

/**
 * Importer for the Fight Club 5e / Game Master 5e XML format
 * (root: <pc version="N"><character>…). The format is shared by the
 * iOS/Mac apps and is the most common XML export for D&D 5e characters.
 *
 * Anything not relevant to the in-session companion (items, AC, money,
 * pet stat blocks, full feat text) is intentionally dropped.
 */

const SCHOOLS: SpellSchool[] = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
];

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

const stripYear = (s: string) => s.replace(/\s*\[(20\d{2})\]\s*$/u, "").trim();

function text(parent: Element | null | undefined, tag: string): string | undefined {
  if (!parent) return undefined;
  // Only direct children — descendants of nested <spell>, <feat>, etc. would otherwise leak in.
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) return child.textContent?.trim() ?? undefined;
  }
  return undefined;
}

function children(parent: Element | null | undefined, tag: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((c) => c.tagName === tag);
}

function intOf(s: string | undefined, fallback = 0): number {
  if (s == null) return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsvInts(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => parseInt(x, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

function proficiencyBonusForLevel(level: number): number {
  return 2 + Math.floor(Math.max(1, level - 1) / 4);
}

function buildComponents(spell: Element): string | undefined {
  const v = text(spell, "v") === "1";
  const s = text(spell, "s") === "1";
  const m = text(spell, "m") === "1";
  const mat = text(spell, "materials");
  const parts: string[] = [];
  if (v) parts.push("V");
  if (s) parts.push("S");
  if (m) parts.push(mat ? `M (${mat})` : "M");
  return parts.length ? parts.join(", ") : undefined;
}

function spellSchool(spell: Element): SpellSchool {
  const idx = intOf(text(spell, "school"), 1) - 1;
  return SCHOOLS[idx] ?? "Abjuration";
}

function spellName(spell: Element): string {
  return stripYear(text(spell, "name") ?? "Unnamed");
}

function spellDuration(spell: Element): string | undefined {
  return text(spell, "duration") || undefined;
}

function isConcentration(duration: string | undefined): boolean {
  return !!duration && /^concentration/i.test(duration);
}

function spellLevel(spell: Element): number {
  // Cantrips have no <level> tag in this format; some exports use <level>0</level>.
  return intOf(text(spell, "level"), 0);
}

function buildCantrip(spell: Element, source: SpellSource): Cantrip {
  return {
    name: spellName(spell),
    school: spellSchool(spell),
    castingTime: text(spell, "time") || undefined,
    range: text(spell, "range") || undefined,
    components: buildComponents(spell),
    duration: spellDuration(spell),
    desc: text(spell, "text") || undefined,
    source,
  };
}

function buildSpell(spell: Element, source: SpellSource, freeCastsPerLongRest?: number): Spell {
  const duration = spellDuration(spell);
  const lvl = Math.min(9, Math.max(1, spellLevel(spell))) as SpellLevel;
  return {
    name: spellName(spell),
    level: lvl,
    school: spellSchool(spell),
    castingTime: text(spell, "time") || undefined,
    range: text(spell, "range") || undefined,
    components: buildComponents(spell),
    duration,
    desc: text(spell, "text") || undefined,
    ritual: text(spell, "ritual") === "1" || undefined,
    concentration: isConcentration(duration) || undefined,
    source,
    freeCastsPerLongRest,
  };
}

function trackerToResource(tracker: Element): Resource | null {
  const name = text(tracker, "label");
  if (!name) return null;
  const max = intOf(text(tracker, "formula"), 1);
  // <value> is the *current* value (remaining), not the used count.
  const valueRaw = text(tracker, "value");
  const remaining = valueRaw == null ? max : intOf(valueRaw, max);
  const used = Math.max(0, max - remaining);
  const resetType = intOf(text(tracker, "resetType"), 2);
  const recharge: Resource["recharge"] =
    resetType === 1 ? "short" : resetType === 2 ? "long" : "manual";
  return {
    name,
    source: "Class feature",
    max,
    used: Math.min(max, used),
    recharge,
  };
}

/**
 * Adds " + N feet" to a range string whose leading number is >= minFeet.
 * Preserves the original number so the modification stays visible against
 * the handbook (e.g. "30 feet" → "30 + 60 feet"). Skips "Self", "Touch",
 * and any non-feet range string.
 */
function applyRangeBonus(
  range: string | undefined,
  bonus: number,
  minFeet: number,
): string | undefined {
  if (!range) return range;
  const m = range.match(/^(\d+)\s*(feet|ft)\b(.*)$/i);
  if (!m) return range;
  const baseFeet = parseInt(m[1], 10);
  if (baseFeet < minFeet) return range;
  return `${baseFeet} + ${bonus} ${m[2]}${m[3]}`;
}

/**
 * Records stripped components on the spell so the renderer can show them
 * with strikethrough. The base `components` string is left untouched so the
 * RAW state remains visible.
 */
function applyStripComponents(
  spell: Cantrip | Spell,
  strip: StripComponent[],
): void {
  const components = spell.components;
  if (!components) return;
  const present = strip.filter((c) =>
    new RegExp(`\\b${c}\\b`).test(components),
  );
  if (present.length === 0) return;
  const existing = spell.componentsStripped ?? [];
  const merged = [...existing];
  for (const c of present) if (!merged.includes(c)) merged.push(c);
  spell.componentsStripped = merged;
}

function applySchoolModifier(spell: Cantrip | Spell, sm: SchoolModifier): void {
  if (spell.school !== sm.school) return;
  if (sm.rangeBonus != null) {
    spell.range = applyRangeBonus(spell.range, sm.rangeBonus, sm.rangeMinFeet ?? 10);
  }
  if (sm.stripComponents && sm.stripComponents.length) {
    applyStripComponents(spell, sm.stripComponents);
  }
}

function inferSubclass(klass: Element): string | undefined {
  for (const feat of children(klass, "feat")) {
    const name = text(feat, "name") ?? "";
    // Common shapes: "Level 3: Wizard Subclass Illusionist", "Level 3: Wizard Subclass: Illusionist".
    const m = name.match(/Subclass[:\s]+([A-Za-z][A-Za-z\s]*?)\s*$/);
    if (m) return m[1].trim();
  }
  return undefined;
}

const HIT_DIE_BY_CLASS: Record<string, number> = {
  Wizard: 6,
  Sorcerer: 6,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Artificer: 8,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Barbarian: 12,
};

const SAVING_THROWS_BY_CLASS: Record<string, Ability[]> = {
  Wizard: ["int", "wis"],
  Sorcerer: ["con", "cha"],
  Warlock: ["wis", "cha"],
  Bard: ["dex", "cha"],
  Cleric: ["wis", "cha"],
  Druid: ["int", "wis"],
  Fighter: ["str", "con"],
  Barbarian: ["str", "con"],
  Monk: ["str", "dex"],
  Paladin: ["wis", "cha"],
  Ranger: ["str", "dex"],
  Rogue: ["dex", "int"],
  Artificer: ["con", "int"],
};

const SPELLCASTING_ABILITY_BY_CLASS: Record<string, Ability> = {
  Wizard: "int",
  Artificer: "int",
  Cleric: "wis",
  Druid: "wis",
  Ranger: "wis",
  Bard: "cha",
  Sorcerer: "cha",
  Warlock: "cha",
  Paladin: "cha",
};

export function parseFightClubXml(xml: string): Character {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid XML: ${parserError.textContent?.trim() ?? "parse error"}`);
  }

  const character = doc.querySelector("pc > character") ?? doc.querySelector("character");
  if (!character) {
    throw new Error("Could not find <character> element. Is this a Fight Club / Game Master 5e export?");
  }

  // ---- basics ----
  const name = text(character, "name") || "Unnamed";
  const abilityVals = parseCsvInts(text(character, "abilities"));
  const abilities = ABILITIES.reduce((acc, key, i) => {
    acc[key] = abilityVals[i] ?? 10;
    return acc;
  }, {} as Record<Ability, number>);

  const hpMax = intOf(text(character, "hpMax"), 1);
  const hpCurrent = intOf(text(character, "hpCurrent"), hpMax);

  // ---- class ----
  const klass = character.querySelector(":scope > class");
  const className = stripYear(text(klass, "name") ?? "Unknown");
  const level = intOf(text(klass, "level"), 1);
  const subclass = klass ? inferSubclass(klass) : undefined;

  // ---- hit dice ----
  // <hdCurrent> in this format is the *unspent* count.
  const hdUnspent = intOf(text(klass, "hdCurrent"), level);
  const hitDice = {
    die: HIT_DIE_BY_CLASS[className] ?? 8,
    max: level,
    spent: Math.max(0, level - hdUnspent),
  };

  // ---- slots: <slots> at the class level is [cantrips, L1..L9] ----
  // <slotsCurrent> in this format is also [cantrips, L1..L9] but represents
  // remaining values. When all zeros (a fresh export that never tracked usage),
  // assume full availability.
  const classSlots = parseCsvInts(text(klass, "slots"));
  // Some exports store the most recent state at the character root level
  // (overriding the class-level zeros). Prefer the higher of the two.
  const characterSlots = parseCsvInts(text(character, "slotsCurrent"));
  const classSlotsCurrent = parseCsvInts(text(klass, "slotsCurrent"));

  const spellSlotsMax: SpellSlots = {};
  const spellSlots: SpellSlots = {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    const max = classSlots[lvl] ?? 0;
    if (max <= 0) continue;
    spellSlotsMax[lvl as SpellLevel] = max;
    const cur = Math.max(
      characterSlots[lvl] ?? 0,
      classSlotsCurrent[lvl] ?? 0,
    );
    spellSlots[lvl as SpellLevel] = Math.min(max, cur > 0 ? cur : max);
  }

  // ---- spells ----
  // Cantrips from any source share one list (always available, no slots).
  // Leveled spells are split: spellbook (class-acquired, can be prepared/swapped/
  // ritual-cast) vs innateSpells (race/feat-granted, always available, free cast
  // per the 2024 PHB lineage rule).
  const cantrips: Cantrip[] = [];
  const spellbook: Spell[] = [];
  const innateSpells: Spell[] = [];
  const preparedSet = new Set<string>();
  const seenCantrips = new Set<string>();
  const seenSpellbook = new Set<string>();
  const seenInnate = new Set<string>();

  const addFromSource = (spell: Element, source: SpellSource) => {
    const lvl = spellLevel(spell);
    const sname = spellName(spell);
    if (lvl === 0) {
      if (!seenCantrips.has(sname)) {
        cantrips.push(buildCantrip(spell, source));
        seenCantrips.add(sname);
      }
      return;
    }
    if (source === "class") {
      if (!seenSpellbook.has(sname)) {
        spellbook.push(buildSpell(spell, source));
        seenSpellbook.add(sname);
      }
      if (text(spell, "prepared") === "1") preparedSet.add(sname);
    } else {
      // race / background / feat / item — leveled grants are innate, not spellbook.
      // Per 2024 PHB lineage rule: 1 free cast per long rest.
      if (!seenInnate.has(sname)) {
        innateSpells.push(buildSpell(spell, source, 1));
        seenInnate.add(sname);
      }
    }
  };

  const race = character.querySelector(":scope > race");
  if (race) for (const sp of children(race, "spell")) addFromSource(sp, "race");

  const background = character.querySelector(":scope > background");
  if (background) for (const sp of children(background, "spell")) addFromSource(sp, "background");

  if (klass) for (const sp of children(klass, "spell")) addFromSource(sp, "class");

  // ---- character-root feats: registry-driven grants ----
  // The XML stores feat benefits as one prose <text> blob, so we map
  // recognized feats to structured grants via FEAT_REGISTRY. Anything
  // already present (e.g. Mage Hand also picked as a class cantrip) wins.
  const featResources: Resource[] = [];
  const featCtx = { abilities, proficiencyBonus: proficiencyBonusForLevel(level) };
  for (const featEl of children(character, "feat")) {
    const rawName = text(featEl, "name");
    if (!rawName) continue;
    const grant = FEAT_REGISTRY[normalizeFeatName(rawName)]?.(featCtx);
    if (!grant) continue;
    for (const cantrip of grant.cantrips ?? []) {
      if (!seenCantrips.has(cantrip.name)) {
        cantrips.push(cantrip);
        seenCantrips.add(cantrip.name);
      }
    }
    for (const sp of grant.innateSpells ?? []) {
      if (!seenInnate.has(sp.name)) {
        innateSpells.push(sp);
        seenInnate.add(sp.name);
      }
    }
    for (const r of grant.resources ?? []) featResources.push(r);
  }

  // ---- subclass: registry-driven grants + per-name and school-wide patches ----
  // Runs after FEAT_REGISTRY so subclass mutations land on every spell already
  // on the character (class spells + feat-granted). See SUBCLASS_FEATURES_DESIGN.md.
  const subclassResources: Resource[] = [];
  if (subclass) {
    const subclassCtx = { abilities, proficiencyBonus: proficiencyBonusForLevel(level), level };
    const grant = SUBCLASS_REGISTRY[subclassRegistryKey(className, subclass)]?.(subclassCtx);
    if (grant) {
      for (const cantrip of grant.cantrips ?? []) {
        if (!seenCantrips.has(cantrip.name)) {
          cantrips.push(cantrip);
          seenCantrips.add(cantrip.name);
        }
      }
      for (const sp of grant.innateSpells ?? []) {
        if (!seenInnate.has(sp.name)) {
          innateSpells.push(sp);
          seenInnate.add(sp.name);
        }
      }
      for (const mod of grant.modifyCantrip ?? []) {
        let target = cantrips.find((c) => c.name === mod.name);
        if (!target && mod.addIfMissing) {
          cantrips.push({ ...mod.addIfMissing });
          seenCantrips.add(mod.addIfMissing.name);
          target = cantrips[cantrips.length - 1];
        }
        if (!target) continue;
        Object.assign(target, mod.patch);
        if (mod.appendDesc) {
          target.desc = target.desc ? `${target.desc}\n\n${mod.appendDesc}` : mod.appendDesc;
        }
      }
      for (const mod of grant.modifySpell ?? []) {
        let target =
          spellbook.find((s) => s.name === mod.name) ??
          innateSpells.find((s) => s.name === mod.name);
        if (!target && mod.addIfMissing) {
          spellbook.push({ ...mod.addIfMissing });
          seenSpellbook.add(mod.addIfMissing.name);
          target = spellbook[spellbook.length - 1];
        }
        if (!target) continue;
        Object.assign(target, mod.patch);
        if (mod.appendDesc) {
          target.desc = target.desc ? `${target.desc}\n\n${mod.appendDesc}` : mod.appendDesc;
        }
      }
      for (const sm of grant.schoolModifiers ?? []) {
        for (const c of cantrips) applySchoolModifier(c, sm);
        for (const s of spellbook) applySchoolModifier(s, sm);
        for (const s of innateSpells) applySchoolModifier(s, sm);
      }
      for (const r of grant.resources ?? []) subclassResources.push(r);
    }
  }

  spellbook.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  innateSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  cantrips.sort((a, b) => a.name.localeCompare(b.name));

  // ---- resources from class-root trackers ----
  // The exporter dumps ALL subclass trackers (Arcane Ward, Portent, etc.) at the
  // class root, regardless of which subclass the character actually has. Filter
  // to only those backed by an active class-root feat with a matching name.
  const resources: Resource[] = [];
  if (klass) {
    const featNames = children(klass, "feat")
      .map((f) => text(f, "name") ?? "")
      .filter(Boolean);
    for (const tr of children(klass, "tracker")) {
      const r = trackerToResource(tr);
      if (!r) continue;
      const hasMatchingFeat = featNames.some((fn) =>
        fn.toLowerCase().includes(r.name.toLowerCase()),
      );
      if (hasMatchingFeat) resources.push(r);
    }
  }
  for (const fr of featResources) {
    if (!resources.some((existing) => existing.name === fr.name)) {
      resources.push(fr);
    }
  }
  for (const sr of subclassResources) {
    if (!resources.some((existing) => existing.name === sr.name)) {
      resources.push(sr);
    }
  }

  const spellcastingAbility =
    SPELLCASTING_ABILITY_BY_CLASS[className] ?? "int";
  const savingThrowProficiencies =
    SAVING_THROWS_BY_CLASS[className] ?? ["int", "wis"];

  return {
    name,
    className,
    subclass,
    level,
    proficiencyBonus: proficiencyBonusForLevel(level),
    abilities,
    savingThrowProficiencies,
    hp: { max: hpMax, current: Math.min(hpMax, hpCurrent), temp: 0 },
    hitDice,
    speed: 30,
    spellcastingAbility,
    spellSlotsMax,
    spellSlots,
    cantrips,
    spellbook,
    innateSpells,
    preparedSpells: Array.from(preparedSet),
    racialFreeCastsUsed: {},
    resources,
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
  };
}
