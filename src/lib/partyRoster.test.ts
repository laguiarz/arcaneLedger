import { describe, it, expect } from "vitest";
import { partyRoster } from "./partyRoster";

describe("partyRoster", () => {
  it("puts the character first, then the party", () => {
    expect(partyRoster({ name: "Brunella", party: ["Kael", "Lynala"] })).toEqual([
      "Brunella",
      "Kael",
      "Lynala",
    ]);
  });

  it("handles a character with no party", () => {
    expect(partyRoster({ name: "Brunella", party: undefined })).toEqual([
      "Brunella",
    ]);
  });

  it("drops blank names", () => {
    expect(partyRoster({ name: "Brunella", party: ["", "  ", "Kael"] })).toEqual([
      "Brunella",
      "Kael",
    ]);
  });
});
