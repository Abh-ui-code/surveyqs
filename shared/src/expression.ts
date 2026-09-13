/**
 * The shared logic evaluator — walks `relevant` / `constraint` / boolean
 * `required` expression strings from a form package (docs/architecture/
 * FORM_SCHEMA.md) against a live answer map. Used identically by the web
 * preview and the mobile renderer so "what the agent sees" and "what the
 * builder previewed" can never drift.
 *
 * Deliberately not a full XLSForm/XPath engine — a small, safe subset:
 *   ${code}              variable reference, resolved from `answers`
 *   .                    the question's own current value (constraints only)
 *   = != >= <= > <       comparisons
 *   and / or / not       boolean combinators (lowercase keywords)
 *   ( ... )              grouping
 *   true / false         boolean literals
 *   123 / 12.5           number literals
 *   'text' / "text"      string literals
 *   selected(a, b)       multi-select membership -- the one function call
 *                        this evaluator knows, kept in lockstep with
 *                        backend/apps/formlogic/functions.py::_selected
 *
 * No eval(), no Function() — every expression is tokenized and walked by
 * hand, so a malformed or malicious string can only ever throw, never run
 * arbitrary code. Any function name other than `selected` throws rather
 * than silently matching -- see callFunction below.
 */
import type { AnswerMap } from "./types";

type Token =
  | { kind: "var"; code: string }
  | { kind: "dot" }
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "op"; value: "=" | "!=" | ">=" | "<=" | ">" | "<" }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "not" }
  | { kind: "ident"; name: string }
  | { kind: "comma" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "comma" });
      i += 1;
      continue;
    }
    if (c === ".") {
      tokens.push({ kind: "dot" });
      i += 1;
      continue;
    }
    if (c === "$" && expr[i + 1] === "{") {
      const end = expr.indexOf("}", i + 2);
      if (end === -1) throw new Error(`Unterminated variable reference in: ${expr}`);
      tokens.push({ kind: "var", code: expr.slice(i + 2, end) });
      i = end + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = expr.indexOf(c, i + 1);
      if (end === -1) throw new Error(`Unterminated string literal in: ${expr}`);
      tokens.push({ kind: "str", value: expr.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (c === "=" ) {
      tokens.push({ kind: "op", value: "=" });
      i += 1;
      continue;
    }
    if (c === "!" && expr[i + 1] === "=") {
      tokens.push({ kind: "op", value: "!=" });
      i += 2;
      continue;
    }
    if (c === ">" && expr[i + 1] === "=") {
      tokens.push({ kind: "op", value: ">=" });
      i += 2;
      continue;
    }
    if (c === "<" && expr[i + 1] === "=") {
      tokens.push({ kind: "op", value: "<=" });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<") {
      tokens.push({ kind: "op", value: c as ">" | "<" });
      i += 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(expr[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j += 1;
      tokens.push({ kind: "num", value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) j += 1;
      const word = expr.slice(i, j);
      if (word === "and") tokens.push({ kind: "and" });
      else if (word === "or") tokens.push({ kind: "or" });
      else if (word === "not") tokens.push({ kind: "not" });
      else if (word === "true") tokens.push({ kind: "bool", value: true });
      else if (word === "false") tokens.push({ kind: "bool", value: false });
      else tokens.push({ kind: "ident", name: word });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character "${c}" in: ${expr}`);
  }
  return tokens;
}

type Ctx = { answers: AnswerMap; current?: unknown };

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly ctx: Ctx,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("Unexpected end of expression");
    this.pos += 1;
    return t;
  }

  parse(): unknown {
    const value = this.orExpr();
    if (this.pos < this.tokens.length) throw new Error("Trailing tokens in expression");
    return value;
  }

  private orExpr(): unknown {
    let left = this.andExpr();
    while (this.peek()?.kind === "or") {
      this.next();
      const right = this.andExpr();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private andExpr(): unknown {
    let left = this.notExpr();
    while (this.peek()?.kind === "and") {
      this.next();
      const right = this.notExpr();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private notExpr(): unknown {
    if (this.peek()?.kind === "not") {
      this.next();
      return !Boolean(this.notExpr());
    }
    return this.comparison();
  }

  private comparison(): unknown {
    const left = this.operand();
    const t = this.peek();
    if (t?.kind === "op") {
      this.next();
      const right = this.operand();
      switch (t.value) {
        case "=":
          return left === right;
        case "!=":
          return left !== right;
        case ">=":
          return Number(left) >= Number(right);
        case "<=":
          return Number(left) <= Number(right);
        case ">":
          return Number(left) > Number(right);
        case "<":
          return Number(left) < Number(right);
      }
    }
    return left;
  }

  private operand(): unknown {
    const t = this.next();
    switch (t.kind) {
      case "dot":
        return this.ctx.current;
      case "var":
        return this.ctx.answers[t.code] ?? null;
      case "num":
        return t.value;
      case "str":
        return t.value;
      case "bool":
        return t.value;
      case "lparen": {
        const value = this.orExpr();
        if (this.next().kind !== "rparen") throw new Error("Expected closing parenthesis");
        return value;
      }
      case "ident": {
        if (this.next().kind !== "lparen") throw new Error(`Expected "(" after "${t.name}"`);
        const args: unknown[] = [];
        if (this.peek()?.kind !== "rparen") {
          args.push(this.orExpr());
          while (this.peek()?.kind === "comma") {
            this.next();
            args.push(this.orExpr());
          }
        }
        if (this.next()?.kind !== "rparen") throw new Error("Expected closing parenthesis");
        return callFunction(t.name, args);
      }
      default:
        throw new Error(`Unexpected token: ${t.kind}`);
    }
  }
}

function asList(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Kept in lockstep with backend/apps/formlogic/functions.py -- only
 * `selected` is implemented; any other name throws (never silently
 * matches), which `evaluateExpression` turns into its `fallback`. */
function callFunction(name: string, args: unknown[]): unknown {
  switch (name) {
    case "selected":
      if (args.length !== 2) throw new Error(`selected() takes 2 arguments, got ${args.length}`);
      return asList(args[0]).includes(args[1]);
    default:
      throw new Error(`Unsupported function "${name}"`);
  }
}

/**
 * Evaluate a `relevant` / `constraint` / boolean-`required` expression.
 * Returns `fallback` (default `true`) if the expression is empty/null, and
 * rethrows nothing — a malformed expression is treated as `fallback` so one
 * bad rule in a published survey can never crash the interview; callers
 * that care can catch via `evaluateExpressionStrict`.
 */
export function evaluateExpression(expr: string | null | undefined, ctx: Ctx, fallback = true): boolean {
  if (!expr) return fallback;
  try {
    return Boolean(new Parser(tokenize(expr), ctx).parse());
  } catch {
    return fallback;
  }
}

export function evaluateExpressionStrict(expr: string, ctx: Ctx): unknown {
  return new Parser(tokenize(expr), ctx).parse();
}
