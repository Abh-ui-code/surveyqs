"""
Evaluates a parsed expression against a context of answers. Two rules from
docs/product/FORM_LOGIC.md are load-bearing and enforced here, not left to
callers:

1. Null propagates. Arithmetic touching a missing answer produces `None`,
   never a crash and never a silent zero -- `coalesce()` is how an author
   opts into treating "unanswered" as zero.
2. A reference to an irrelevant or unanswered question is `None`, never a
   KeyError. The evaluator has no way to know relevance on its own; the
   caller (formlogic/relevance.py) is responsible for excluding irrelevant
   answers from the context before evaluating anything that depends on them.
"""
from apps.formlogic.ast_nodes import (
    BinaryOp,
    DotValue,
    FunctionCall,
    Literal,
    Node,
    Reference,
    UnaryOp,
)
from apps.formlogic.exceptions import ExpressionEvaluationError
from apps.formlogic.functions import FUNCTIONS, _as_number


class EvalContext:
    """
    `answers` is a flat {question_code: value} map for the current scope.
    Inside a repeat instance, the renderer/validator builds a fresh context
    per instance with the instance's own values merged over the parent
    scope, and `escapes_repeat` references are resolved against `parent`.
    """

    def __init__(self, answers: dict, dot_value=None, parent: "EvalContext | None" = None):
        self.answers = answers
        self.dot_value = dot_value
        self.parent = parent

    def resolve(self, path: str, escapes_repeat: bool):
        scope = self.parent if (escapes_repeat and self.parent is not None) else self
        return scope.answers.get(path)


def evaluate(node: Node, context: EvalContext):
    if isinstance(node, Literal):
        return node.value

    if isinstance(node, DotValue):
        return context.dot_value

    if isinstance(node, Reference):
        return context.resolve(node.path, node.escapes_repeat)

    if isinstance(node, UnaryOp):
        value = evaluate(node.operand, context)
        if node.op == "not":
            return not bool(value)
        if node.op == "-":
            n = _as_number(value)
            return None if n is None else -n
        raise ExpressionEvaluationError(f"Unknown unary operator {node.op!r}")

    if isinstance(node, BinaryOp):
        return _evaluate_binary(node, context)

    if isinstance(node, FunctionCall):
        fn = FUNCTIONS.get(node.name)
        if fn is None:
            raise ExpressionEvaluationError(f"Unknown function {node.name!r}")
        args = [evaluate(arg, context) for arg in node.args]
        return fn(*args)

    raise ExpressionEvaluationError(f"Unhandled node type: {type(node).__name__}")


def _evaluate_binary(node: BinaryOp, context: EvalContext):
    if node.op == "and":
        left = evaluate(node.left, context)
        return bool(left) and bool(evaluate(node.right, context))
    if node.op == "or":
        left = evaluate(node.left, context)
        return bool(left) or bool(evaluate(node.right, context))

    left = evaluate(node.left, context)
    right = evaluate(node.right, context)

    if node.op in {"=", "!="}:
        equal = left == right
        return equal if node.op == "=" else not equal

    if node.op in {"<", "<=", ">", ">="}:
        if left is None or right is None:
            return False  # a comparison against missing data is false, not an error
        if isinstance(left, str) or isinstance(right, str):
            lv, rv = str(left), str(right)
        else:
            lv, rv = left, right
        return {
            "<": lv < rv, "<=": lv <= rv, ">": lv > rv, ">=": lv >= rv,
        }[node.op]

    # Arithmetic: null propagates.
    ln, rn = _as_number(left), _as_number(right)
    if ln is None or rn is None:
        return None
    if node.op == "+":
        return ln + rn
    if node.op == "-":
        return ln - rn
    if node.op == "*":
        return ln * rn
    if node.op == "/":
        return None if rn == 0 else ln / rn
    if node.op == "mod":
        return None if rn == 0 else ln % rn

    raise ExpressionEvaluationError(f"Unknown binary operator {node.op!r}")


def safe_evaluate_bool(node: Node, context: EvalContext) -> bool:
    """
    Used for `relevant`. An evaluation error resolves to `False` and is
    logged rather than raised -- a form that crashes mid-interview is worse
    than one that hides a question. Publish-time validation is what catches
    a genuinely broken expression before it ever reaches a device.
    """
    try:
        return bool(evaluate(node, context))
    except ExpressionEvaluationError:
        return False
