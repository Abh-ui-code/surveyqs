import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-paper-raised pl-8 pr-8 text-sm text-ink",
          "placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:bg-paper-sunken hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
