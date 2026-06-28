import { describe, it, expect } from "vitest";
import {
  classifyCastingTime,
  castingTimeMatchesFilter,
  actionTypeMatchesFilter,
} from "@/lib/actionType";

describe("classifyCastingTime", () => {
  it("classifies plain and numbered actions", () => {
    expect(classifyCastingTime("Action")).toBe("action");
    expect(classifyCastingTime("1 action")).toBe("action");
  });

  it("classifies bonus actions, not as plain actions", () => {
    expect(classifyCastingTime("Bonus Action")).toBe("bonus");
    expect(classifyCastingTime("1 bonus action")).toBe("bonus");
  });

  it("classifies reactions including trailing trigger prose", () => {
    expect(classifyCastingTime("1 reaction")).toBe("reaction");
    expect(
      classifyCastingTime(
        "1 reaction, which you take when you or a creature you can see within 60 feet of you falls",
      ),
    ).toBe("reaction");
  });

  it("returns 'other' for longer or missing casting times", () => {
    expect(classifyCastingTime("1 minute")).toBe("other");
    expect(classifyCastingTime("10 minutes")).toBe("other");
    expect(classifyCastingTime("")).toBe("other");
    expect(classifyCastingTime(undefined)).toBe("other");
  });
});

describe("castingTimeMatchesFilter", () => {
  it("matches everything under the 'all' filter", () => {
    expect(castingTimeMatchesFilter("all", "1 minute")).toBe(true);
    expect(castingTimeMatchesFilter("all", undefined)).toBe(true);
  });

  it("matches only the selected action type", () => {
    expect(castingTimeMatchesFilter("reaction", "1 reaction")).toBe(true);
    expect(castingTimeMatchesFilter("reaction", "Bonus Action")).toBe(false);
    expect(castingTimeMatchesFilter("bonus", "Bonus Action")).toBe(true);
    expect(castingTimeMatchesFilter("action", "1 action")).toBe(true);
  });

  it("excludes 'other' casting times from specific filters", () => {
    expect(castingTimeMatchesFilter("action", "1 minute")).toBe(false);
  });
});

describe("actionTypeMatchesFilter", () => {
  it("matches everything under the 'all' filter", () => {
    expect(actionTypeMatchesFilter("all", undefined)).toBe(true);
    expect(actionTypeMatchesFilter("all", "reaction")).toBe(true);
  });

  it("matches a tagged resource only to its own type", () => {
    expect(actionTypeMatchesFilter("reaction", "reaction")).toBe(true);
    expect(actionTypeMatchesFilter("bonus", "reaction")).toBe(false);
  });

  it("never matches an untagged resource under a specific filter", () => {
    expect(actionTypeMatchesFilter("bonus", undefined)).toBe(false);
    expect(actionTypeMatchesFilter("reaction", undefined)).toBe(false);
  });
});
