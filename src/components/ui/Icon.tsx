interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: number;
  weight?: number;
}

export default function Icon({ name, filled = false, className = "", size, weight = 400 }: IconProps) {
  const style: React.CSSProperties = {
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
    fontSize: size ? `${size}px` : undefined,
    lineHeight: 1,
  };
  return (
    <span aria-hidden className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}
