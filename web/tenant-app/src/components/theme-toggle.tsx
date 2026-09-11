"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/theme-provider";

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const CurrentIcon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-paper-sunken hover:text-ink"
        title="Theme"
      >
        <CurrentIcon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setMode(opt.value)}>
            <opt.icon className="h-4 w-4" />
            {opt.label}
            {mode === opt.value && <Check className="ml-auto h-3.5 w-3.5 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
