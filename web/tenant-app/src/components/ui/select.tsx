import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/** A styled native <select> -- deliberately not a Radix Select. A native
 * element gives free keyboard, mobile and screen-reader behaviour that a
 * custom listbox has to reimplement, and this app doesn't need anything a
 * native select can't do. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-md border bg-paper-raised pl-3 pr-8 text-sm text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-rust" : "border-line",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
    </div>
  ),
);
Select.displayName = "Select";
