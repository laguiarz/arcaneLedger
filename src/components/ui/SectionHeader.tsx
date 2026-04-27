import Icon from "./Icon";

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function SectionHeader({ icon, title, subtitle, right }: Props) {
  return (
    <div className="flex items-end justify-between gap-sm mb-sm">
      <div className="flex items-center gap-sm">
        {icon && <Icon name={icon} className="text-primary text-2xl" />}
        <div>
          <h2 className="font-serif text-headline-md text-primary leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-on-surface-variant text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-xs">{right}</div>}
    </div>
  );
}
