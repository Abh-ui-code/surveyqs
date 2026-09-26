"""
Branch-question adjacency -- the single rule every surface that renders a
section's questions (the web builder, the collection flow, the response
detail page, and the mobile interview screen) sorts against, so a
skip-logic question can never drift away from the question its `relevant`
condition points at. There is no structural parent/child link for this
(that's `parent_question`, reserved for repeat groups) -- a branch question
is just an ordinary sibling whose `relevant` expression happens to
reference another sibling's code, so "is this a branch, and of what" has to
be read back out of that string. Mirrors shared/src/question-order.ts
exactly; keep the two in lockstep.
"""
import re

_CONDITION_REF_RE = re.compile(r"\$\{(\w+)\}")


def condition_source_code(relevant: str | None) -> str | None:
    """The question code a `relevant` condition points at -- e.g.
    `${salary} = true` -> "salary". Only the first reference is used: the
    builder's condition editor only ever writes one."""
    if not relevant:
        return None
    match = _CONDITION_REF_RE.search(relevant)
    return match.group(1) if match else None


def sort_questions_by_branch_adjacency(questions: list) -> list:
    """
    Reorders a flat list of sibling `Question` rows (same section) so every
    branch question sits directly after its parent, however they arrived
    out of order (a drag that dropped something between them, a condition
    added after the fact, stale data). Otherwise preserves input order:
    top-level questions keep their relative order, and each parent's branch
    children keep theirs.

    A `relevant` reference that's missing, unrelated, or part of a cycle
    never drops a question from the list -- it's just treated as top-level
    instead.
    """
    codes = {q.code for q in questions}
    children_by_parent: dict[str, list] = {}
    top_level: list = []

    for q in questions:
        source_code = condition_source_code(q.relevant)
        if source_code and source_code != q.code and source_code in codes:
            children_by_parent.setdefault(source_code, []).append(q)
        else:
            top_level.append(q)

    result: list = []
    visited: set[str] = set()

    def emit(q):
        if q.code in visited:  # a cyclic `relevant` reference
            return
        visited.add(q.code)
        result.append(q)
        for child in children_by_parent.get(q.code, []):
            emit(child)

    for q in top_level:
        emit(q)
    # Left over only by a cycle among branch questions with no top-level
    # member (e.g. two questions each conditioned on the other) -- append
    # rather than silently drop.
    for q in questions:
        if q.code not in visited:
            emit(q)

    return result
