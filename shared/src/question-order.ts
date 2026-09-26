/**
 * Branch-question adjacency — the single rule every surface that renders a
 * section's questions (the web builder, the collection flow, the response
 * detail page, and the mobile interview screen) sorts against, so a
 * skip-logic question can never drift away from the question its `relevant`
 * condition points at. There is no structural parent/child link for this
 * (that's `parent_question`, reserved for repeat groups) — a branch question
 * is just an ordinary sibling whose `relevant` expression happens to
 * reference another sibling's code, so "is this a branch, and of what" has
 * to be read back out of that string. Mirrors
 * backend/apps/surveys/question_order.py exactly; keep the two in lockstep.
 */

export interface BranchableQuestion {
  code: string;
  relevant?: string | null;
}

/** The question code a `relevant` condition points at — e.g.
 * `${salary} = true` -> "salary". Only the first reference is used: the
 * builder's condition editor only ever writes one. */
export function conditionSourceCode(relevant: string | null | undefined): string | null {
  if (!relevant) return null;
  return relevant.match(/\$\{(\w+)\}/)?.[1] ?? null;
}

/** The parent code a question renders as a branch under — only when that
 * parent is another question among `siblings`; a condition pointing at
 * anything else (an earlier section, a since-deleted question) has no
 * adjacent row to nest under, so it stays top-level rather than vanishing
 * or floating under the wrong row. */
export function branchParentCode<Q extends BranchableQuestion>(question: Q, siblings: readonly Q[]): string | null {
  const sourceCode = conditionSourceCode(question.relevant);
  if (!sourceCode || sourceCode === question.code) return null;
  return siblings.some((q) => q.code === sourceCode) ? sourceCode : null;
}

/**
 * Reorders a flat list of sibling questions so every branch question sits
 * directly after its parent, however they arrived out of order (a drag that
 * dropped something between them, a condition added after the fact, stale
 * data). Otherwise preserves input order: top-level questions keep their
 * relative order, and each parent's branch children keep theirs.
 *
 * A `relevant` reference that's missing, unrelated, or part of a cycle is
 * never allowed to drop a question from the list — it's just treated as
 * top-level instead.
 */
export function sortByBranchAdjacency<Q extends BranchableQuestion>(questions: readonly Q[]): Q[] {
  const childrenByParent = new Map<string, Q[]>();
  const topLevel: Q[] = [];

  for (const q of questions) {
    const parentCode = branchParentCode(q, questions);
    if (parentCode) {
      const siblings = childrenByParent.get(parentCode);
      if (siblings) siblings.push(q);
      else childrenByParent.set(parentCode, [q]);
    } else {
      topLevel.push(q);
    }
  }

  const result: Q[] = [];
  const visited = new Set<string>();

  function emit(q: Q) {
    if (visited.has(q.code)) return; // a cyclic `relevant` reference
    visited.add(q.code);
    result.push(q);
    for (const child of childrenByParent.get(q.code) ?? []) emit(child);
  }

  for (const q of topLevel) emit(q);
  // Left over only by a cycle among branch questions with no top-level
  // member (e.g. two questions each conditioned on the other) -- append
  // rather than silently drop.
  for (const q of questions) {
    if (!visited.has(q.code)) emit(q);
  }

  return result;
}
