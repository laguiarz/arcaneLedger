/**
 * One "label … value" line in a stat breakdown. Shared by the Armor Class and
 * Attacks panels so the two cannot drift apart visually.
 *
 * `value` accepts a string so a row can render "—" for a bonus that does not
 * apply — a row that says nothing is better than a row that is missing, which
 * looks the same as a bug.
 */
export default function BreakdownRow({
  label,
  value,
  hint,
  signed,
}: {
  label: string;
  value: number | string;
  hint?: string;
  signed?: boolean;
}) {
  const shown =
    typeof value === "number" && signed
      ? value >= 0
        ? `+${value}`
        : `${value}`
      : value;

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-on-surface-variant truncate">
        {label}
        {hint && <span className="text-outline text-xs"> · {hint}</span>}
      </span>
      <span className="font-mono text-on-surface shrink-0">{shown}</span>
    </li>
  );
}
