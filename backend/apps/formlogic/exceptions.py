class ExpressionError(Exception):
    """Raised at parse time -- a syntax problem the builder should surface
    at publish time, never at runtime."""


class ExpressionEvaluationError(Exception):
    """
    Raised at evaluation time for a genuinely malformed reference (unknown
    function, wrong arity). Never raised for a missing or irrelevant
    question -- that resolves to `None` and propagates, per the null-handling
    rule in docs/product/FORM_LOGIC.md. Callers evaluating `relevant` treat
    this as `False` rather than crash mid-interview; callers validating a
    published survey treat it as a publish-time error.
    """
