import { describe, it, expect } from "vitest";
import { libraryNotice } from "./libraryFlags";

const base = {
  activeCharacterId: "brunella",
  loadedRevision: "aaa",
  availableRevision: "bbb",
  appUpdatePending: false,
};

describe("libraryNotice", () => {
  it("offers the reload when the revisions differ", () => {
    expect(libraryNotice(base)).toBe("update");
  });

  it("says nothing when the revisions match", () => {
    expect(libraryNotice({ ...base, availableRevision: "aaa" })).toBe("none");
  });

  it("lets a pending app update win", () => {
    // Both buttons at once is the PR #23 case: reloading the sheet under the old
    // bundle leaves the new content unrendered and looks like the reload failed.
    expect(libraryNotice({ ...base, appUpdatePending: true })).toBe("none");
  });

  it.each([null, "sample", "custom"])(
    "says nothing for a non-library character (%s)",
    (id) => {
      expect(libraryNotice({ ...base, activeCharacterId: id })).toBe("none");
    },
  );

  it("says nothing before the manifest has been checked", () => {
    // Unchecked, offline, entry removed, or a manifest older than revisions.
    expect(libraryNotice({ ...base, availableRevision: null })).toBe("none");
  });

  it("admits it does not know when the sheet predates revisions", () => {
    // Every install on the first boot after this shipped. It still offers the
    // reload, but must not claim a newer version exists.
    expect(libraryNotice({ ...base, loadedRevision: null })).toBe("unknown");
  });

  it("keeps quiet about an unknown revision when there is nothing to compare", () => {
    expect(
      libraryNotice({ ...base, loadedRevision: null, availableRevision: null }),
    ).toBe("none");
  });
});
