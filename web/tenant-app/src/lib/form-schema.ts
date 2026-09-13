/**
 * The published form package shape (docs/architecture/FORM_SCHEMA.md) plus
 * the small set of helpers that read it -- relevance, branch-question
 * nesting, and answer display formatting. Shared by every screen that
 * renders a survey's structure against a set of answers: the collection
 * flow (`surveys/[id]/collect`) renders it live as someone types, and the
 * response detail page (`responses/[id]`) renders it once, read-only,
 * against answers already submitted. Both need the same section/question
 * order, the same labels, and the same branch layout -- keeping the logic
 * in one place is what keeps them from drifting apart.
 */
import { evaluateExpression, type AnswerMap } from "@surveyqs/shared";

export interface ChoiceDef {
  value: string;
  label: Record<string, string>;
  order: number;
  attrs: Record<string, unknown>;
  active: boolean;
}

export interface ChoiceListDef {
  name: string;
  attributes: Record<string, unknown>;
  choices: ChoiceDef[];
}

export interface SchemaQuestion {
  id: string;
  code: string;
  order: number;
  type: string;
  label: Record<string, string>;
  hint: Record<string, string>;
  required: boolean | string;
  relevant: string | null;
  constraint: string | null;
  constraint_message: Record<string, string> | null;
  config: Record<string, unknown> & { choice_list?: string; min?: number; max?: number; decimal_places?: number };
  questions?: SchemaQuestion[];
}

export interface SchemaSection {
  id: string;
  code: string;
  order: number;
  title: Record<string, string>;
  description: Record<string, string>;
  relevant: string | null;
  questions: SchemaQuestion[];
}

export interface FormPackage {
  schema_version: string;
  survey_id: string;
  version_number: number;
  title: string;
  description: string;
  instructions: string;
  settings: Record<string, unknown>;
  choice_lists: ChoiceListDef[];
  sections: SchemaSection[];
}

/** A section whose `relevant` is false hides every question inside it,
 * regardless of that question's own condition -- mirrors
 * backend/apps/formlogic/relevance.py::relevant_question_codes, which is
 * the server's authoritative version of this same rule. */
export function isSectionRelevant(section: SchemaSection, answers: AnswerMap): boolean {
  return evaluateExpression(section.relevant, { answers }, true);
}

export function isQuestionRelevant(section: SchemaSection, question: SchemaQuestion, answers: AnswerMap): boolean {
  return isSectionRelevant(section, answers) && evaluateExpression(question.relevant, { answers }, true);
}

export function relevantQuestionCodes(sections: SchemaSection[], answers: AnswerMap): Set<string> {
  const codes = new Set<string>();
  for (const section of sections) {
    if (!isSectionRelevant(section, answers)) continue;
    for (const q of section.questions) {
      if (evaluateExpression(q.relevant, { answers }, true)) codes.add(q.code);
    }
  }
  return codes;
}

/** The question code a `relevant` condition points at (its "parent"), read
 * straight out of the expression string -- e.g. `${salary} = true` -> the
 * "salary" the builder's condition editor stored it against. Only the
 * first reference is used: today's builder only ever writes one. */
export function conditionSourceCode(question: SchemaQuestion): string | null {
  if (!question.relevant) return null;
  return question.relevant.match(/\$\{(\w+)\}/)?.[1] ?? null;
}

/** A question renders as a branch under its parent only when that parent
 * is another question in the very same section -- a condition pointing at
 * an earlier section has no adjacent row to nest under, so it stays flush. */
export function branchParentCode(section: SchemaSection, question: SchemaQuestion): string | null {
  const sourceCode = conditionSourceCode(question);
  if (!sourceCode) return null;
  return section.questions.some((q) => q.code === sourceCode) ? sourceCode : null;
}

/** Renders a stored answer value the way a human should read it -- "Yes"
 * rather than `true`, a choice's label rather than its stored value, etc.
 * `value === undefined` means "not answered". */
export function displayAnswer(
  question: SchemaQuestion,
  value: unknown,
  choiceLabel: (listName: string, value: string) => string,
): string {
  if (value === undefined || value === null) return "—";
  switch (question.type) {
    case "yes_no":
      return value ? "Yes" : "No";
    case "select_one":
      return choiceLabel((question.config.choice_list as string) ?? "", value as string);
    case "select_multiple":
      return (value as string[]).map((v) => choiceLabel((question.config.choice_list as string) ?? "", v)).join(", ");
    case "geopoint": {
      const g = value as { lat: number; lng: number };
      return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
    }
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}
