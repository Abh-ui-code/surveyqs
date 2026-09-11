"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="center">
        <DialogHeader className="flex flex-row items-start gap-3 space-y-0">
          {variant === "danger" && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust-soft text-rust">
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <DialogBody className="text-sm text-ink-muted">{description}</DialogBody>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "danger" ? "destructive" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
