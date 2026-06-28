import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import type { Combatant } from "@/types/combat";
import { buildNarrationPayload } from "@/lib/combatLog";
import { generateNarration } from "@/lib/gemini";
import {
  DEFAULT_MODEL,
  getApiKey,
  getModel,
  getPrompt,
  resetPrompt,
  setApiKey,
  setModel,
  setPrompt,
} from "@/lib/combatNarration";

type Phase = "idle" | "loading" | "result" | "error";

/**
 * End-of-combat bardic narration. Builds a transcript from the recorded actions
 * and asks Gemini (the configured cheap model) to retell it in Brunella's voice.
 * Exposes an editable prompt + key/model settings inline so the player can tune
 * the style without leaving the fight.
 */
export default function NarrationModal({
  open,
  onClose,
  combatants,
  totalRounds,
  activeName,
}: {
  open: boolean;
  onClose: () => void;
  combatants: Combatant[];
  totalRounds: number;
  activeName?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState(DEFAULT_MODEL);
  const [promptDraft, setPromptDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  // Seed the editable settings from storage whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setApiKeyDraft(getApiKey());
    setModelDraft(getModel());
    setPromptDraft(getPrompt());
    // Settings stay collapsed by default — production needs no client key
    // (the /api/narrate proxy holds it). Open them on demand for model/prompt.
    setShowSettings(false);
  }, [open]);

  // Abort any in-flight request if the modal closes.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  const persistSettings = () => {
    setApiKey(apiKeyDraft);
    setModel(modelDraft);
    setPrompt(promptDraft);
  };

  const generate = async () => {
    persistSettings();
    setPhase("loading");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const userContent = buildNarrationPayload(
        combatants,
        totalRounds,
        activeName,
      );
      const result = await generateNarration({
        // Optional: only used if the proxy is absent (local dev fallback).
        apiKey: apiKeyDraft.trim() || undefined,
        model: modelDraft.trim() || DEFAULT_MODEL,
        systemPrompt: promptDraft.trim() || getPrompt(),
        userContent,
        signal: controller.signal,
      });
      setText(result);
      setPhase("result");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="La crónica de Brunella"
      width="max-w-2xl"
    >
      <div className="space-y-md">
        <button
          className="flex items-center gap-1 text-xs text-outline hover:text-on-surface transition"
          onClick={() => setShowSettings((v) => !v)}
        >
          <Icon name={showSettings ? "expand_less" : "tune"} size={16} />
          {showSettings ? "Hide settings" : "Settings (key · model · prompt)"}
        </button>

        {showSettings && (
          <div className="space-y-sm border border-outline-variant/40 rounded-lg p-sm bg-surface-container-low">
            <div className="flex flex-wrap gap-sm">
              <label className="flex flex-col gap-1 flex-1 min-w-[14rem]">
                <span className="label-caps text-outline text-[10px]">
                  Gemini API key (local dev only)
                </span>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="AIza… — not needed in production (server proxy)"
                  className="input-inset w-full font-mono text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 w-40">
                <span className="label-caps text-outline text-[10px]">Model</span>
                <input
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                  placeholder={DEFAULT_MODEL}
                  className="input-inset w-full font-mono text-xs"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="label-caps text-outline text-[10px]">
                Prompt (Brunella&apos;s style)
              </span>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                className="input-inset w-full h-40 text-xs leading-relaxed"
              />
            </label>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !py-1" onClick={persistSettings}>
                <Icon name="save" /> Save
              </button>
              <button
                className="btn-ghost !py-1"
                onClick={() => {
                  resetPrompt();
                  setPromptDraft(getPrompt());
                }}
              >
                <Icon name="refresh" /> Reset prompt
              </button>
              <span className="text-[10px] text-outline italic ml-auto">
                In production the key stays server-side; this field is for local dev.
              </span>
            </div>
          </div>
        )}

        {phase === "idle" && (
          <p className="text-sm text-on-surface-variant">
            Turn this fight into a poem. Brunella will recount it round by round,
            embellishing each blow with what she knows of the foes.
          </p>
        )}

        {phase === "loading" && (
          <div className="flex items-center gap-sm text-on-surface-variant py-lg justify-center">
            <Icon name="hourglass_top" className="animate-pulse" />
            Composing the ballad…
          </div>
        )}

        {phase === "error" && error && (
          <p className="text-sm text-error border border-error/40 bg-error/10 rounded-md px-sm py-2">
            {error}
          </p>
        )}

        {phase === "result" && (
          <article className="font-serif text-on-surface text-[15px] leading-relaxed whitespace-pre-wrap max-h-[45vh] overflow-y-auto pr-1 border-l-2 border-primary/40 pl-md">
            {text}
          </article>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-sm border-t border-outline-variant/30">
          <button
            className="btn-brass"
            onClick={() => void generate()}
            disabled={phase === "loading"}
          >
            <Icon name="auto_awesome" filled />
            {phase === "result" || phase === "error" ? "Regenerate" : "Compose"}
          </button>
          {phase === "result" && (
            <button className="btn-ghost" onClick={() => void copy()}>
              <Icon name={copied ? "check" : "content_copy"} />
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button className="btn-ghost ml-auto" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
