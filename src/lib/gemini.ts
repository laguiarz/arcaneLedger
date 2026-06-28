/**
 * Thin Google Gemini (Generative Language API) client for the combat narration.
 *
 * SECURITY NOTE: this calls the Gemini API directly from the browser, which
 * means the API key travels with the request and is readable in client code /
 * network logs. That is an accepted trade-off for this personal, local-first
 * tool (there is no backend). Do NOT ship this pattern to a multi-tenant or
 * public deployment — proxy through a server that holds the key instead.
 */

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

export interface ChatRequestParams {
  systemPrompt: string;
  userContent: string;
  /** 0–2; higher = more florid. Bardic prose wants this fairly high. */
  temperature?: number;
}

/** Build the JSON request body. Pure, so the shape stays unit-testable. */
export function buildGeminiRequest(p: ChatRequestParams) {
  return {
    systemInstruction: { parts: [{ text: p.systemPrompt }] },
    contents: [{ role: "user" as const, parts: [{ text: p.userContent }] }],
    generationConfig: { temperature: p.temperature ?? 0.9 },
  };
}

export interface GenerateParams extends ChatRequestParams {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

/** Call Gemini and return the generated text. Throws on any failure. */
export async function generateNarration(p: GenerateParams): Promise<string> {
  if (!p.apiKey.trim()) {
    throw new Error("Missing Gemini API key.");
  }

  let res: Response;
  try {
    res = await fetch(endpoint(p.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": p.apiKey.trim(),
      },
      body: JSON.stringify(buildGeminiRequest(p)),
      signal: p.signal,
    });
  } catch (e) {
    throw new Error(
      `Network error reaching Gemini: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* keep the status-line detail */
    }
    throw new Error(`Gemini request failed: ${detail}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request (${data.promptFeedback.blockReason}).`,
    );
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}
