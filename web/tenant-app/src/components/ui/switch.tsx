"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors",
      "data-[state=checked]:bg-brand",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform",
        "data-[state=checked]:translate-x-[18px]",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
