import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium text-ink", className)}
    {...props}
  >
    {children}
    {required && <span className="ml-0.5 text-rust">*</span>}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";
