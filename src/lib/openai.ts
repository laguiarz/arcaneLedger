/**
 * Thin OpenAI Chat Completions client used for the combat narration.
 *
 * SECURITY NOTE: this calls the OpenAI API directly from the browser, which
 * means the API key travels with the request and is readable in client code /
 * network logs. That is an accepted trade-off for this personal, local-first
 * tool (there is no backend). Do NOT ship this pattern to a multi-tenant or
 * public deployment — proxy through a server that holds the key instead.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export interface ChatRequestParams {
  model: string;
  systemPrompt: string;
  userContent: string;
  /** 0–2; higher = more florid. Bardic prose wants this fairly high. */
  temperature?: number;
}

/** Build the JSON request body. Pure, so the shape stays unit-testable. */
export function buildChatRequest(p: ChatRequestParams) {
  return {
    model: p.model,
    temperature: p.temperature ?? 0.9,
    messages: [
      { role: "system" as const, content: p.systemPrompt },
      { role: "user" as const, content: p.userContent },
    ],
  };
}

export interface GenerateParams extends ChatRequestParams {
  apiKey: string;
  signal?: AbortSignal;
}

/** Call OpenAI and return the assistant message text. Throws on any failure. */
export async function generateChatCompletion(
  p: GenerateParams,
): Promise<string> {
  if (!p.apiKey.trim()) {
    throw new Error("Missing OpenAI API key.");
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey.trim()}`,
      },
      body: JSON.stringify(buildChatRequest(p)),
      signal: p.signal,
    });
  } catch (e) {
    throw new Error(
      `Network error reaching OpenAI: ${
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
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }
  return text;
}
