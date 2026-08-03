import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useLibrary } from "./library";
import { useCharacter } from "./character";
import type { Character } from "@/types/character";

const sheet = (name: string): Character =>
  ({
    name,
    className: "Bard",
    level: 5,
    proficiencyBonus: 3,
    abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 18 },
    hp: { max: 28, current: 28, temp: 0 },
    ac: 14,
    initiativeBonus: 2,
    speed: 30,
    spellSlots: {},
    spellSlotsMax: {},
    cantrips: [],
    spellbook: [],
    preparedSpells: [],
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
    party: [],
    skills: {},
    notes: "",
  }) as unknown as Character;

/** Manifest entry + character body, served to whichever url is asked for. */
function serve(entries: unknown[], character: Character) {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("manifest") ? { version: 1, characters: entries } : character,
  }));
}

function loadAs(id: string, revision: string | null) {
  useCharacter.getState().loadCharacter(sheet("Brunella"), {
    sourceId: id,
    revision,
  });
}

beforeEach(() => {
  useLibrary.setState({
    availableRevision: null,
    checking: false,
    reloading: false,
    lastError: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("check", () => {
  it("records the revision the manifest advertises", async () => {
    loadAs("brunella", "old");
    vi.stubGlobal(
      "fetch",
      serve([{ id: "brunella", name: "Brunella", revision: "new" }], sheet("x")),
    );
    await useLibrary.getState().check();
    expect(useLibrary.getState().availableRevision).toBe("new");
  });

  it("does nothing for an imported character", async () => {
    useCharacter.getState().loadCharacter(sheet("Imported"));
    const fetchMock = serve([], sheet("x"));
    vi.stubGlobal("fetch", fetchMock);
    await useLibrary.getState().check();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the revision when the entry is gone from the manifest", async () => {
    loadAs("brunella", "old");
    useLibrary.setState({ availableRevision: "seen-once" });
    vi.stubGlobal("fetch", serve([{ id: "lyari", name: "Lyari" }], sheet("x")));
    await useLibrary.getState().check();
    // Otherwise a revision seen once would pin the notice open forever.
    expect(useLibrary.getState().availableRevision).toBeNull();
  });

  it("leaves the last known revision alone when the fetch fails", async () => {
    loadAs("brunella", "old");
    useLibrary.setState({ availableRevision: "new" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await useLibrary.getState().check();
    // A failed check must read neither as "up to date" nor as "there's an update".
    expect(useLibrary.getState().availableRevision).toBe("new");
    expect(useLibrary.getState().lastError).toMatch(/offline/);
  });
});

describe("reload", () => {
  it("replaces the sheet and records the revision", async () => {
    loadAs("brunella", "old");
    vi.stubGlobal(
      "fetch",
      serve(
        [{ id: "brunella", name: "Brunella", revision: "new" }],
        sheet("Brunella v2"),
      ),
    );
    await useLibrary.getState().reload();
    expect(useCharacter.getState().character.name).toBe("Brunella v2");
    expect(useCharacter.getState().libraryRevision).toBe("new");
    expect(useLibrary.getState().availableRevision).toBe("new");
  });

  it("records the revision it fetched, not one that landed mid-flight", async () => {
    loadAs("brunella", "old");
    // The manifest resolves with "r1"; while the character body is still in
    // flight, a background check() lands "r2". Recording r2 for r1's content
    // would silence the notice forever with a stale sheet.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes("manifest")) {
            return {
              version: 1,
              characters: [{ id: "brunella", name: "B", revision: "r1" }],
            };
          }
          useLibrary.setState({ availableRevision: "r2" });
          return sheet("Brunella r1");
        },
      })),
    );
    await useLibrary.getState().reload();
    expect(useCharacter.getState().libraryRevision).toBe("r1");
  });

  it("refuses to run twice at once", async () => {
    loadAs("brunella", "old");
    useLibrary.setState({ reloading: true });
    const fetchMock = serve([], sheet("x"));
    vi.stubGlobal("fetch", fetchMock);
    await useLibrary.getState().reload();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failure and leaves the sheet alone", async () => {
    loadAs("brunella", "old");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await useLibrary.getState().reload();
    expect(useLibrary.getState().lastError).toMatch(/network down/);
    expect(useLibrary.getState().reloading).toBe(false);
    expect(useCharacter.getState().libraryRevision).toBe("old");
  });
});
