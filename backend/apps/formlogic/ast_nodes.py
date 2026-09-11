"""AST node types produced by the parser and consumed by the evaluator."""
from dataclasses import dataclass, field


class Node:
    """Marker base class."""


@dataclass(frozen=True)
class Literal(Node):
    value: object  # str | float | bool | None


@dataclass(frozen=True)
class Reference(Node):
    """`${question_code}` or `${../question_code}` (one level outside a repeat)."""

    path: str
    escapes_repeat: bool = False


@dataclass(frozen=True)
class DotValue(Node):
    """The bare `.` inside a `constraint` expression -- the value just entered."""


@dataclass(frozen=True)
class UnaryOp(Node):
    op: str  # "-" | "not"
    operand: Node


@dataclass(frozen=True)
class BinaryOp(Node):
    op: str  # "=" "!=" "<" "<=" ">" ">=" "+" "-" "*" "/" "mod" "and" "or"
    left: Node
    right: Node


@dataclass(frozen=True)
class FunctionCall(Node):
    name: str
    args: list = field(default_factory=list)
