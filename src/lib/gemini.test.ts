import { describe, it, expect } from "vitest";
import { buildGeminiRequest } from "@/lib/gemini";

describe("buildGeminiRequest", () => {
  it("maps the prompt to systemInstruction and the content to a user turn", () => {
    const body = buildGeminiRequest({
      systemPrompt: "You are Brunella.",
      userContent: "Round 1: ...",
    });
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "You are Brunella." }],
    });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Round 1: ..." }] },
    ]);
  });

  it("defaults temperature to a florid 0.9 and lets it be overridden", () => {
    expect(
      buildGeminiRequest({ systemPrompt: "", userContent: "" }).generationConfig
        .temperature,
    ).toBe(0.9);
    expect(
      buildGeminiRequest({ systemPrompt: "", userContent: "", temperature: 0.2 })
        .generationConfig.temperature,
    ).toBe(0.2);
  });
});
