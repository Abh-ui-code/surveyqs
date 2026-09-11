"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type Side = "right" | "center";

const SIDE_STYLES: Record<Side, string> = {
  right:
    "fixed inset-y-0 right-0 h-full w-full max-w-md border-l border-line bg-paper-raised " +
    "shadow-xl data-[state=open]:animate-slide-in-right flex flex-col",
  center:
    "fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg " +
    "border border-line bg-paper-raised shadow-xl data-[state=open]:animate-scale-in " +
    "max-h-[90vh] flex flex-col",
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: Side }
>(({ className, side = "center", children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-ink/30 backdrop-blur-[1px] data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(SIDE_STYLES[side], "z-[101] outline-none", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-ink-faint hover:bg-paper-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 border-b border-line px-5 py-4", className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-line bg-paper-sunken/50 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold text-ink", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm text-ink-muted", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";
