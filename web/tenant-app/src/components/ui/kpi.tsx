import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  brand: "border-l-brand",
  amber: "border-l-amber",
  rust: "border-l-rust",
  moss: "border-l-moss",
  slate: "border-l-slate",
};

export function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent = "brand",
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: keyof typeof ACCENT;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line border-l-[3px] bg-paper-raised p-4",
        ACCENT[accent],
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1.5 font-mono-data text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}
