/**
 * Client for the Gemini combat narration.
 *
 * Primary path is the server proxy at `/api/narrate`, which holds the API key
 * server-side so it never reaches the browser (see api/narrate.ts). When the
 * proxy isn't available — e.g. `npm run dev` serves only the Vite app and
 * `/api/*` 404s — it falls back to calling Gemini directly from the browser,
 * which requires a local key (dev convenience only). Production should always
 * use the proxy.
 */

const PROXY_URL = "/api/narrate";

const directEndpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

export interface ChatRequestParams {
  systemPrompt: string;
  userContent: string;
  /** 0–2; higher = more florid. Bardic prose wants this fairly high. */
  temperature?: number;
}

/** Build the JSON request body for a direct Gemini call. Pure / unit-testable. */
export function buildGeminiRequest(p: ChatRequestParams) {
  return {
    systemInstruction: { parts: [{ text: p.systemPrompt }] },
    contents: [{ role: "user" as const, parts: [{ text: p.userContent }] }],
    generationConfig: { temperature: p.temperature ?? 0.9 },
  };
}

export interface GenerateParams extends ChatRequestParams {
  model: string;
  /** Only used for the direct dev fallback; the proxy needs no client key. */
  apiKey?: string;
  signal?: AbortSignal;
}

/** Generate the narration, preferring the server proxy. Throws on failure. */
export async function generateNarration(p: GenerateParams): Promise<string> {
  let proxyRes: Response | null = null;
  try {
    proxyRes = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        systemPrompt: p.systemPrompt,
        userContent: p.userContent,
        temperature: p.temperature,
      }),
      signal: p.signal,
    });
  } catch (e) {
    if (p.signal?.aborted) throw e;
    proxyRes = null; // proxy unreachable — try the direct fallback below
  }

  if (proxyRes && proxyRes.ok) {
    const data = (await proxyRes.json().catch(() => ({}))) as { text?: string };
    const text = data.text?.trim();
    if (text) return text;
    throw new Error("Narration proxy returned an empty response.");
  }

  // Proxy is deployed but errored (not a 404): surface its real message.
  if (proxyRes && proxyRes.status !== 404) {
    let detail = `${proxyRes.status} ${proxyRes.statusText}`;
    try {
      const e = (await proxyRes.json()) as { error?: string };
      if (e?.error) detail = e.error;
    } catch {
      /* keep status-line detail */
    }
    throw new Error(detail);
  }

  // No proxy here (404 or unreachable) → direct browser call (dev only).
  if (!p.apiKey?.trim()) {
    throw new Error(
      "Narration unavailable: deploy the /api/narrate proxy, or set a Gemini API key for local use.",
    );
  }
  return directGeminiCall(p);
}

async function directGeminiCall(p: GenerateParams): Promise<string> {
  const apiKey = p.apiKey!.trim();
  let res: Response;
  try {
    res = await fetch(directEndpoint(p.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
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
      /* keep status-line detail */
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
