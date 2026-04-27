import Icon from "./Icon";

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
}

export default function Stepper({ value, onChange, min = 0, max = 9999, step = 1, ariaLabel }: StepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="inline-flex items-center gap-1" aria-label={ariaLabel}>
      <button
        type="button"
        className="btn-icon"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Icon name="remove" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="input-inset w-16 text-center font-mono text-on-surface"
      />
      <button
        type="button"
        className="btn-icon"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="Increase"
      >
        <Icon name="add" />
      </button>
    </div>
  );
}
