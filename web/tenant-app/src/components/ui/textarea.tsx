import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-md border bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "disabled:opacity-50 disabled:cursor-not-allowed resize-y",
        error ? "border-rust" : "border-line",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
