import { useRef, useState } from "react";
import { useCharacter } from "@/store/character";
import SectionHeader from "@/components/ui/SectionHeader";
import Icon from "@/components/ui/Icon";
import { parseFightClubXml } from "@/lib/importFightClubXml";

export default function Settings() {
  const character = useCharacter((s) => s.character);
  const exportJson = useCharacter((s) => s.exportJson);
  const loadCharacter = useCharacter((s) => s.loadCharacter);
  const resetToSample = useCharacter((s) => s.resetToSample);

  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const json = exportJson();

  const handleLoad = (raw: string) => {
    setError(null);
    setOkMsg(null);
    try {
      const trimmed = raw.trimStart();
      const looksXml = trimmed.startsWith("<?xml") || trimmed.startsWith("<pc");
      const parsed = looksXml ? parseFightClubXml(raw) : JSON.parse(raw);
      if (!parsed.name || !parsed.abilities || !parsed.hp) {
        throw new Error("Missing required fields (name, abilities, hp).");
      }
      loadCharacter(parsed);
      setOkMsg(
        `Loaded ${parsed.name}` +
          (looksXml
            ? ` from XML (${parsed.spellbook?.length ?? 0} spells, ${parsed.cantrips?.length ?? 0} cantrips).`
            : "."),
      );
      setPaste("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    handleLoad(text);
  };

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setOkMsg("JSON copied to clipboard.");
  };

  return (
    <div className="max-w-4xl mx-auto p-md md:p-lg space-y-lg">
      <SectionHeader
        icon="settings"
        title="Settings"
        subtitle="Import, export, or reset the character"
      />

      <section className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
        <div className="leather-noise absolute inset-0" />
        <div className="relative">
          <h3 className="font-serif text-title-sm text-primary mb-sm">Import</h3>
          <p className="text-sm text-on-surface-variant mb-sm">
            Paste character JSON or a Fight Club 5e / Game Master 5e XML export below,
            or upload a <code>.json</code> / <code>.xml</code> file.
          </p>
          <textarea
            className="input-inset w-full h-40 font-mono text-xs"
            placeholder='{ "name": "...", ... }   or   <?xml ...><pc><character>…'
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex flex-wrap gap-sm mt-sm">
            <button className="btn-brass" onClick={() => handleLoad(paste)} disabled={!paste.trim()}>
              <Icon name="upload" /> Load Pasted
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="folder_open" /> Choose file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.xml,application/json,application/xml,text/xml"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <button
              className="btn-ghost !text-error !border-error/40 ml-auto"
              onClick={() => {
                if (confirm("Reset to the sample wizard? Current state will be lost.")) {
                  resetToSample();
                  setOkMsg("Reset to sample wizard.");
                }
              }}
            >
              <Icon name="refresh" /> Reset to sample
            </button>
          </div>
          {error && (
            <p className="mt-sm text-sm text-error border border-error/40 bg-error/10 rounded-md px-sm py-2">
              {error}
            </p>
          )}
          {okMsg && (
            <p className="mt-sm text-sm text-secondary border border-secondary/40 bg-secondary/10 rounded-md px-sm py-2">
              {okMsg}
            </p>
          )}
        </div>
      </section>

      <section className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
        <div className="leather-noise absolute inset-0" />
        <div className="relative">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-serif text-title-sm text-primary">Export</h3>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={copy}>
                <Icon name="content_copy" /> Copy
              </button>
              <button className="btn-brass" onClick={download}>
                <Icon name="download" /> Download
              </button>
            </div>
          </div>
          <pre className="bg-surface-container-lowest border border-outline-variant/40 rounded-md p-sm text-xs font-mono overflow-auto max-h-96 text-on-surface-variant">
            {json}
          </pre>
        </div>
      </section>
    </div>
  );
}
