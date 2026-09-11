"""
Tokenizer for the SurveyQs expression language. Deliberately small: this is
the language that must produce identical behaviour in Python (here) and in
the TypeScript port used by the web and mobile clients, so every token kind
is chosen for how unambiguous it is to lex the same way twice.
"""
import re
from dataclasses import dataclass
from enum import Enum, auto

from apps.formlogic.exceptions import ExpressionError


class TokenKind(Enum):
    NUMBER = auto()
    STRING = auto()
    REFERENCE = auto()  # ${question_code} or ${../question_code}
    IDENT = auto()  # function names, true/false/null, and/or/not/mod
    DOT = auto()  # the bare `.` referring to the value under constraint
    LPAREN = auto()
    RPAREN = auto()
    COMMA = auto()
    OP = auto()  # = != < <= > >= + - * /
    EOF = auto()


@dataclass(frozen=True)
class Token:
    kind: TokenKind
    value: str
    position: int


_TOKEN_SPEC = [
    (TokenKind.REFERENCE, r"\$\{[a-zA-Z_][a-zA-Z0-9_./]*\}"),
    (TokenKind.NUMBER, r"\d+\.\d+|\d+"),
    (TokenKind.STRING, r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\""),
    (TokenKind.OP, r"<=|>=|!=|==|=|<|>|\+|-|\*|/"),
    (TokenKind.LPAREN, r"\("),
    (TokenKind.RPAREN, r"\)"),
    (TokenKind.COMMA, r","),
    (TokenKind.DOT, r"\."),
    (TokenKind.IDENT, r"[a-zA-Z_][a-zA-Z0-9_]*"),
    ("SKIP", r"[ \t\n]+"),
]
_MASTER_RE = re.compile("|".join(f"(?P<t{i}>{pattern})" for i, (_, pattern) in enumerate(_TOKEN_SPEC)))
_KIND_BY_INDEX = [kind for kind, _ in _TOKEN_SPEC]


def tokenize(source: str) -> list[Token]:
    tokens: list[Token] = []
    pos = 0
    length = len(source)
    while pos < length:
        match = _MASTER_RE.match(source, pos)
        if match is None:
            raise ExpressionError(f"Unexpected character {source[pos]!r} at position {pos}.")
        group_name = match.lastgroup
        index = int(group_name[1:])
        kind = _KIND_BY_INDEX[index]
        text = match.group()
        if kind != "SKIP":
            tokens.append(Token(kind=kind, value=text, position=pos))
        pos = match.end()
    tokens.append(Token(kind=TokenKind.EOF, value="", position=length))
    return tokens
