"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";

/** Question types that store an answer against a `choice_list` -- gates the
 * options editor in the add/edit question drawers. */
export const OPTION_TYPES = new Set(["select_one", "select_multiple"]);

/** Question types with a min/max (and, for decimal, a precision) config. */
export const NUMERIC_TYPES = new Set(["integer", "decimal"]);

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface NumericConfig {
  min?: string;
  max?: string;
  decimal_places?: string;
}

function slugifyValue(label: string, index: number, siblings: ChoiceOption[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `option_${index + 1}`;
  const used = new Set(siblings.filter((_, i) => i !== index).map((o) => o.value));
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix++}`;
  }
  return candidate;
}

export function defaultOptions(): ChoiceOption[] {
  return [
    { value: "", label: "" },
    { value: "", label: "" },
  ];
}

/** Shared options editor for `select_one` / `select_multiple` -- both store
 * their answer against the same kind of choice list, differing only in
 * whether the respondent picks one value or several (see question-field.tsx). */
export function ChoiceOptionsEditor({
  options,
  onChange,
}: {
  options: ChoiceOption[];
  onChange: (options: ChoiceOption[]) => void;
}) {
  const update = (index: number, label: string) => {
    const next = options.slice();
    next[index] = { value: slugifyValue(label, index, options), label };
    onChange(next);
  };
  const remove = (index: number) => onChange(options.filter((_, i) => i !== index));
  const add = () => onChange([...options, { value: "", label: "" }]);

  return (
    <DrawerField label="Options" required hint="Shown to the respondent in this order.">
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder={`Option ${index + 1}`}
              value={option.label}
              onChange={(e) => update(index, e.target.value)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-rust-soft hover:text-rust"
              title="Remove option"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add option
        </Button>
      </div>
    </DrawerField>
  );
}

export function NumericConfigFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: NumericConfig;
  onChange: (config: NumericConfig) => void;
}) {
  return (
    <DrawerSection title="Validation">
      <div className="grid grid-cols-2 gap-3">
        <DrawerField label="Minimum">
          <Input type="number" value={config.min ?? ""} onChange={(e) => onChange({ ...config, min: e.target.value })} />
        </DrawerField>
        <DrawerField label="Maximum">
          <Input type="number" value={config.max ?? ""} onChange={(e) => onChange({ ...config, max: e.target.value })} />
        </DrawerField>
      </div>
      {type === "decimal" && (
        <DrawerField label="Decimal places">
          <Input
            type="number"
            min={0}
            value={config.decimal_places ?? ""}
            onChange={(e) => onChange({ ...config, decimal_places: e.target.value })}
          />
        </DrawerField>
      )}
    </DrawerSection>
  );
}

export function RatingConfigField({ max, onChange }: { max: string; onChange: (max: string) => void }) {
  return (
    <DrawerField label="Scale (highest value)" hint="Respondents pick 1 through this number.">
      <Input type="number" min={2} max={10} value={max} onChange={(e) => onChange(e.target.value)} />
    </DrawerField>
  );
}

/** Builds the `config` payload sent to the API from the drawer's local
 * (string-based, form-friendly) config state. */
export function buildConfigPayload(type: string, numeric: NumericConfig, ratingMax: string): Record<string, unknown> {
  if (NUMERIC_TYPES.has(type)) {
    const config: Record<string, unknown> = {};
    if (numeric.min !== undefined && numeric.min !== "") config.min = Number(numeric.min);
    if (numeric.max !== undefined && numeric.max !== "") config.max = Number(numeric.max);
    if (type === "decimal" && numeric.decimal_places !== undefined && numeric.decimal_places !== "") {
      config.decimal_places = Number(numeric.decimal_places);
    }
    return config;
  }
  if (type === "rating") {
    return ratingMax !== "" ? { max: Number(ratingMax) } : {};
  }
  return {};
}
