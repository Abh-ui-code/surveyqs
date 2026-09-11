"use client";

import { Check, Image as ImageIcon, MapPin, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChoiceListDef, SchemaQuestion } from "../_hooks/use-collect";

export type AnswerValue = string | number | boolean | string[] | { lat: number; lng: number; accuracy?: number };

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Mirrors the shape backend/apps/formlogic/validate.py::_check_required
 * expects, so a field that will pass client-side also passes the server's
 * re-validation -- this is UX only, the server remains authoritative. */
export function isQuestionAnswered(question: SchemaQuestion, value: unknown): boolean {
  if (question.required !== true) return true;
  return !isEmpty(value);
}

function YesNoToggle({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: "Yes" },
        { v: false, label: "No" },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v)}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
            value === opt.v
              ? "border-brand bg-brand-soft text-brand-strong"
              : "border-line bg-paper-raised text-ink-muted hover:bg-paper-sunken",
          )}
        >
          {value === opt.v && <Check className="h-3.5 w-3.5" />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RatingInput({ max, value, onChange }: { max: number; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
            value === n
              ? "border-brand bg-brand text-brand-contrast"
              : "border-line bg-paper-raised text-ink-muted hover:bg-paper-sunken",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function GeopointCapture({
  value,
  onChange,
}: {
  value: { lat: number; lng: number; accuracy?: number } | undefined;
  onChange: (v: { lat: number; lng: number; accuracy?: number }) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");

  const capture = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setStatus("idle");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={capture} loading={status === "locating"}>
        <MapPin className="h-4 w-4" /> {value ? "Recapture location" : "Capture current location"}
      </Button>
      {value && (
        <p className="font-mono-data text-xs text-ink-muted">
          {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          {value.accuracy && ` (±${Math.round(value.accuracy)}m)`}
        </p>
      )}
      {status === "error" && <p className="text-xs text-rust">Couldn&rsquo;t get your location. You can skip this if it&rsquo;s optional.</p>}
    </div>
  );
}

function ImageCapture({ file, onChange }: { file: File | undefined; onChange: (f: File | undefined) => void }) {
  return (
    <div className="space-y-2">
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-line bg-paper-sunken px-3 py-2 text-sm text-ink">
          <ImageIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => onChange(undefined)} className="shrink-0 text-ink-faint hover:text-rust">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-line bg-paper-raised px-3 text-sm text-ink-muted hover:bg-paper-sunken">
          <ImageIcon className="h-4 w-4" /> Choose photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}

export function QuestionField({
  question,
  choiceLists,
  value,
  error,
  onChange,
  imageFile,
  onImageChange,
}: {
  question: SchemaQuestion;
  choiceLists: Record<string, ChoiceListDef>;
  value: AnswerValue | undefined;
  error?: string;
  onChange: (value: AnswerValue | undefined) => void;
  imageFile?: File;
  onImageChange?: (file: File | undefined) => void;
}) {
  const label = question.label.en ?? question.code;
  const hint = question.hint?.en;
  const required = question.required === true;

  if (question.type === "note") {
    return <p className="rounded-md bg-paper-sunken px-3 py-2.5 text-sm text-ink-muted">{label}</p>;
  }

  const field = (() => {
    switch (question.type) {
      case "long_text":
        return (
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            error={!!error}
          />
        );
      case "email":
        return (
          <Input
            type="email"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            error={!!error}
          />
        );
      case "phone":
        return (
          <Input
            type="tel"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            error={!!error}
          />
        );
      case "integer":
        return (
          <Input
            type="number"
            step={1}
            min={question.config.min as number | undefined}
            max={question.config.max as number | undefined}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            error={!!error}
          />
        );
      case "decimal":
        return (
          <Input
            type="number"
            step={question.config.decimal_places ? 1 / 10 ** (question.config.decimal_places as number) : "any"}
            min={question.config.min as number | undefined}
            max={question.config.max as number | undefined}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            error={!!error}
          />
        );
      case "rating":
        return <RatingInput max={(question.config.max as number) || 5} value={value as number | undefined} onChange={onChange} />;
      case "yes_no":
        return <YesNoToggle value={value as boolean | undefined} onChange={onChange} />;
      case "select_one": {
        const choices = choiceLists[question.config.choice_list ?? ""]?.choices ?? [];
        return (
          <Select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)} error={!!error}>
            <option value="">Select one...</option>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label.en ?? c.value}
              </option>
            ))}
          </Select>
        );
      }
      case "select_multiple": {
        const choices = choiceLists[question.config.choice_list ?? ""]?.choices ?? [];
        const selected = (value as string[] | undefined) ?? [];
        return (
          <div className="space-y-2">
            {choices.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm text-ink">
                <Checkbox
                  checked={selected.includes(c.value)}
                  onCheckedChange={(checked) => {
                    const next = checked ? [...selected, c.value] : selected.filter((v) => v !== c.value);
                    onChange(next.length > 0 ? next : undefined);
                  }}
                />
                {c.label.en ?? c.value}
              </label>
            ))}
          </div>
        );
      }
      case "date":
        return (
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            error={!!error}
          />
        );
      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            error={!!error}
          />
        );
      case "geopoint":
        return (
          <GeopointCapture
            value={value as { lat: number; lng: number; accuracy?: number } | undefined}
            onChange={onChange}
          />
        );
      case "image":
        return <ImageCapture file={imageFile} onChange={(f) => onImageChange?.(f)} />;
      default:
        return (
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)} error={!!error} />
        );
    }
  })();

  return (
    <DrawerField label={label} required={required} error={error} hint={hint}>
      {field}
    </DrawerField>
  );
}
