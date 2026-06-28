/**
 * Vercel serverless proxy for the Gemini combat narration.
 *
 * Holds the API key server-side (process.env.GEMINI_KEY) so it NEVER reaches
 * the browser. The client posts the prompt + transcript here and gets back only
 * the generated text. Set GEMINI_KEY in the Vercel project's Environment
 * Variables (Production + Preview) — do NOT prefix it with VITE_.
 *
 * Self-contained on purpose (no imports from src/) so it bundles cleanly as a
 * standalone function. Uses the global fetch available on Vercel's Node runtime.
 */

interface NarrateBody {
  model?: string;
  systemPrompt?: string;
  userContent?: string;
  temperature?: number;
}

interface GeminiPart {
  text?: string;
}

// Minimal shapes for the Vercel Node request/response (types stripped at build).
interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing the GEMINI_KEY env var." });
    return;
  }

  const body: NarrateBody =
    typeof req.body === "string"
      ? (JSON.parse(req.body || "{}") as NarrateBody)
      : ((req.body as NarrateBody) ?? {});

  const model = (body.model || "gemini-2.5-flash").trim();
  const systemPrompt = body.systemPrompt ?? "";
  const userContent = body.userContent ?? "";
  if (!userContent.trim()) {
    res.status(400).json({ error: "Missing userContent." });
    return;
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { temperature: body.temperature ?? 0.9 },
        }),
      },
    );

    if (!r.ok) {
      let detail = `${r.status} ${r.statusText}`;
      try {
        const e = (await r.json()) as { error?: { message?: string } };
        if (e?.error?.message) detail = e.error.message;
      } catch {
        /* keep status-line detail */
      }
      res.status(r.status).json({ error: `Gemini request failed: ${detail}` });
      return;
    }

    const data = (await r.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      res
        .status(422)
        .json({ error: `Gemini blocked the request (${data.promptFeedback.blockReason}).` });
      return;
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      res.status(502).json({ error: "Gemini returned an empty response." });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({
      error: `Network error reaching Gemini: ${
        e instanceof Error ? e.message : String(e)
      }`,
    });
  }
}
