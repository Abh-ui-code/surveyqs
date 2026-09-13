"use client";

import { Switch } from "@/components/ui/switch";
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChoiceListItem, Section } from "../../_hooks/use-surveys";

/** Question types that can gate another question's visibility -- limited to
 * types whose comparisons the evaluator supports identically on the server
 * (backend/apps/formlogic) and on both clients (shared/src/expression.ts,
 * used by mobile and, via this feature, the web collection flow). */
const SOURCE_TYPES = new Set(["yes_no", "select_one", "select_multiple", "integer", "decimal", "rating"]);

export interface EligibleSource {
  code: string;
  label: string;
  type: string;
  choices?: { value: string; label: string }[];
}

/** Every question that could legally appear in this question's `relevant`
 * expression -- anything earlier in document order (backend/apps/surveys/
 * validators.py blocks self- and forward-references at publish time), and
 * restricted to SOURCE_TYPES. `excludeQuestionId`/`beforeOrder` scope this to
 * "before a specific question"; omit both to mean "before a new question
 * appended at the end of `uptoSectionId`". */
export function eligibleConditionSources(
  sections: Section[],
  choiceLists: ChoiceListItem[],
  scope: { uptoSectionId: string; excludeQuestionId?: string; beforeOrder?: number },
): EligibleSource[] {
  const sectionIndex = sections.findIndex((s) => s.id === scope.uptoSectionId);
  if (sectionIndex === -1) return [];

  const sources: EligibleSource[] = [];
  for (let i = 0; i <= sectionIndex; i++) {
    const section = sections[i];
    for (const q of section.questions) {
      if (q.id === scope.excludeQuestionId) continue;
      if (i === sectionIndex && scope.beforeOrder !== undefined && q.order >= scope.beforeOrder) continue;
      if (!SOURCE_TYPES.has(q.type)) continue;
      const list = q.choice_list ? choiceLists.find((cl) => cl.id === q.choice_list) : undefined;
      sources.push({
        code: q.code,
        label: q.label.en ?? q.code,
        type: q.type,
        choices: list?.choices.map((c) => ({ value: c.value, label: c.label.en ?? c.value })),
      });
    }
  }
  return sources;
}

export type ConditionState =
  | { mode: "always" }
  | { mode: "conditional"; sourceCode: string; operator: string; value: string }
  | { mode: "custom"; expression: string };

export function emptyCondition(): ConditionState {
  return { mode: "always" };
}

const YES_NO_OPS = [
  { value: "is_true", label: "is Yes" },
  { value: "is_false", label: "is No" },
];
const SINGLE_CHOICE_OPS = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
];
const MULTI_CHOICE_OPS = [
  { value: "includes", label: "includes" },
  { value: "not_includes", label: "does not include" },
];
const NUMERIC_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];

function operatorsFor(sourceType: string | undefined): { value: string; label: string }[] {
  if (sourceType === "yes_no") return YES_NO_OPS;
  if (sourceType === "select_one") return SINGLE_CHOICE_OPS;
  if (sourceType === "select_multiple") return MULTI_CHOICE_OPS;
  return NUMERIC_OPS;
}

/** Compiles the drawer's condition state into the `relevant` expression
 * string the API stores -- kept in exact sync with the patterns
 * `parseCondition` recognizes below, and with the grammar both evaluators
 * (backend/apps/formlogic, shared/src/expression.ts) implement. */
export function compileCondition(condition: ConditionState): string {
  if (condition.mode === "always") return "";
  if (condition.mode === "custom") return condition.expression.trim();

  const { sourceCode, operator, value } = condition;
  switch (operator) {
    case "is_true":
      return `\${${sourceCode}} = true`;
    case "is_false":
      return `\${${sourceCode}} = false`;
    case "equals":
      return `\${${sourceCode}} = '${value}'`;
    case "not_equals":
      return `\${${sourceCode}} != '${value}'`;
    case "includes":
      return `selected(\${${sourceCode}}, '${value}')`;
    case "not_includes":
      return `not(selected(\${${sourceCode}}, '${value}'))`;
    case "eq":
      return `\${${sourceCode}} = ${value}`;
    case "neq":
      return `\${${sourceCode}} != ${value}`;
    case "gt":
      return `\${${sourceCode}} > ${value}`;
    case "gte":
      return `\${${sourceCode}} >= ${value}`;
    case "lt":
      return `\${${sourceCode}} < ${value}`;
    case "lte":
      return `\${${sourceCode}} <= ${value}`;
    default:
      return "";
  }
}

const PATTERNS: { re: RegExp; operator: string }[] = [
  { re: /^\$\{(\w+)\}\s*=\s*true$/, operator: "is_true" },
  { re: /^\$\{(\w+)\}\s*=\s*false$/, operator: "is_false" },
  { re: /^\$\{(\w+)\}\s*=\s*'([^']*)'$/, operator: "equals" },
  { re: /^\$\{(\w+)\}\s*!=\s*'([^']*)'$/, operator: "not_equals" },
  { re: /^selected\(\$\{(\w+)\},\s*'([^']*)'\)$/, operator: "includes" },
  { re: /^not\(selected\(\$\{(\w+)\},\s*'([^']*)'\)\)$/, operator: "not_includes" },
  { re: /^\$\{(\w+)\}\s*=\s*(-?\d+(?:\.\d+)?)$/, operator: "eq" },
  { re: /^\$\{(\w+)\}\s*!=\s*(-?\d+(?:\.\d+)?)$/, operator: "neq" },
  { re: /^\$\{(\w+)\}\s*>=\s*(-?\d+(?:\.\d+)?)$/, operator: "gte" },
  { re: /^\$\{(\w+)\}\s*<=\s*(-?\d+(?:\.\d+)?)$/, operator: "lte" },
  { re: /^\$\{(\w+)\}\s*>\s*(-?\d+(?:\.\d+)?)$/, operator: "gt" },
  { re: /^\$\{(\w+)\}\s*<\s*(-?\d+(?:\.\d+)?)$/, operator: "lt" },
];

/** Best-effort inverse of `compileCondition`, for prefilling the edit
 * drawer from a saved `relevant` string. A condition set some other way (or
 * one that doesn't match a pattern this builder produces) falls back to
 * "custom", shown as an editable raw expression rather than lost. */
export function parseCondition(expression: string, sources: EligibleSource[]): ConditionState {
  const trimmed = expression.trim();
  if (!trimmed) return { mode: "always" };

  for (const { re, operator } of PATTERNS) {
    const match = trimmed.match(re);
    if (!match) continue;
    const [, sourceCode, value] = match;
    const source = sources.find((s) => s.code === sourceCode);
    if (!source) continue;
    const validOps = operatorsFor(source.type).map((o) => o.value);
    if (!validOps.includes(operator)) continue;
    return { mode: "conditional", sourceCode, operator, value: value ?? "" };
  }
  return { mode: "custom", expression: trimmed };
}

export function ConditionEditor({
  sources,
  condition,
  onChange,
}: {
  sources: EligibleSource[];
  condition: ConditionState;
  onChange: (condition: ConditionState) => void;
}) {
  if (condition.mode === "custom") {
    return (
      <DrawerSection title="Visibility">
        <DrawerField
          label="Custom condition"
          hint="Set outside the simple builder -- edit the raw expression, or switch to always show."
        >
          <Textarea
            className="font-mono-data text-xs"
            rows={2}
            value={condition.expression}
            onChange={(e) => onChange({ mode: "custom", expression: e.target.value })}
          />
        </DrawerField>
        <label className="flex items-center gap-2 text-sm text-ink">
          <Switch checked={false} onCheckedChange={() => onChange({ mode: "always" })} />
          Always show instead
        </label>
      </DrawerSection>
    );
  }

  const isConditional = condition.mode === "conditional";
  const source = isConditional ? sources.find((s) => s.code === condition.sourceCode) : undefined;
  const ops = operatorsFor(source?.type);

  return (
    <DrawerSection title="Visibility">
      <label className="flex items-center gap-2 text-sm text-ink">
        <Switch
          checked={isConditional}
          onCheckedChange={(checked) => {
            if (!checked) {
              onChange({ mode: "always" });
              return;
            }
            const first = sources[0];
            onChange(
              first
                ? { mode: "conditional", sourceCode: first.code, operator: operatorsFor(first.type)[0].value, value: first.choices?.[0]?.value ?? "" }
                : { mode: "always" },
            );
          }}
          disabled={!isConditional && sources.length === 0}
        />
        Only show if a previous answer matches
      </label>

      {isConditional && sources.length === 0 && (
        <p className="text-xs text-ink-faint">
          No earlier Yes/No, choice, number or rating question is available yet to base this on.
        </p>
      )}

      {isConditional && sources.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Select
            className="col-span-3"
            value={condition.sourceCode}
            onChange={(e) => {
              const next = sources.find((s) => s.code === e.target.value);
              onChange({
                mode: "conditional",
                sourceCode: e.target.value,
                operator: operatorsFor(next?.type)[0].value,
                value: next?.choices?.[0]?.value ?? "",
              });
            }}
          >
            {sources.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </Select>

          <Select
            value={condition.operator}
            onChange={(e) => onChange({ ...condition, operator: e.target.value })}
          >
            {ops.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          {source?.type === "yes_no" ? null : source?.choices ? (
            <Select
              className="col-span-2"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
            >
              {source.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              className="col-span-2"
              type="number"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
            />
          )}
        </div>
      )}
    </DrawerSection>
  );
}
