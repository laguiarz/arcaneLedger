import type { ReactNode } from "react";

/**
 * Renders a spell's components string with stripped components shown
 * struck through. The base `components` string is preserved as-is — only
 * the visual rendering changes — so the RAW state stays auditable
 * against the handbook.
 *
 * Components are split on commas. A part is struck-through if its first
 * letter (V/S/M) is in the `stripped` set. "M (specific item)" is struck
 * as a whole, since stripping M removes the material requirement entirely.
 */
export function SpellComponentsText({
  components,
  stripped,
}: {
  components?: string;
  stripped?: Array<"V" | "S" | "M">;
}): ReactNode {
  if (!components) return null;
  if (!stripped || stripped.length === 0) return components;

  const parts = components.split(/,\s*/);
  return parts.map((part, idx) => {
    const firstChar = part.trim().charAt(0).toUpperCase() as "V" | "S" | "M";
    const isStripped = stripped.includes(firstChar);
    const sep = idx < parts.length - 1 ? ", " : "";
    return (
      <span key={idx}>
        {isStripped ? <s>{part}</s> : part}
        {sep}
      </span>
    );
  });
}
