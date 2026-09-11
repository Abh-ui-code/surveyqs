import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The two layout primitives every form drawer in the app is built from. */
export function DrawerSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-strong">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function DrawerField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-rust">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
