import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        error ? "border-rust" : "border-line",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
