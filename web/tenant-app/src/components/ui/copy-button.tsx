"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy", ...props }: { value: string; label?: string } & Omit<ButtonProps, "onClick">) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Button type="button" variant="secondary" onClick={onClick} {...props}>
      {copied ? <Check className="h-4 w-4 text-moss" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
