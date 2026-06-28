import { describe, it, expect } from "vitest";
import { buildChatRequest } from "@/lib/openai";

describe("buildChatRequest", () => {
  it("packs the system + user messages in order", () => {
    const body = buildChatRequest({
      model: "gpt-4o-mini",
      systemPrompt: "You are Brunella.",
      userContent: "Round 1: ...",
    });
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([
      { role: "system", content: "You are Brunella." },
      { role: "user", content: "Round 1: ..." },
    ]);
  });

  it("defaults temperature to a florid 0.9 and lets it be overridden", () => {
    expect(buildChatRequest({ model: "m", systemPrompt: "", userContent: "" }).temperature).toBe(0.9);
    expect(
      buildChatRequest({ model: "m", systemPrompt: "", userContent: "", temperature: 0.2 })
        .temperature,
    ).toBe(0.2);
  });
});
