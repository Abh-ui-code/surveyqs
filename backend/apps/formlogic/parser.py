"""
Recursive-descent parser. Precedence, low to high:
    or  ->  and  ->  not  ->  comparison  ->  additive  ->  multiplicative  ->  unary  ->  atom

This mirrors the shared grammar documented in docs/product/FORM_LOGIC.md and
must stay in lock-step with the TypeScript parser -- both are exercised
against the same fixture table in tests/.
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
from apps.formlogic.exceptions import ExpressionError
from apps.formlogic.lexer import Token, TokenKind, tokenize

_COMPARISON_OPS = {"=", "==", "!=", "<", "<=", ">", ">="}
_ADDITIVE_OPS = {"+", "-"}
_MULTIPLICATIVE_OPS = {"*", "/"}


class Parser:
    def __init__(self, tokens: list[Token]):
        self._tokens = tokens
        self._pos = 0

    @property
    def _current(self) -> Token:
        return self._tokens[self._pos]

    def _advance(self) -> Token:
        token = self._current
        self._pos += 1
        return token

    def _expect(self, kind: TokenKind, value: str | None = None) -> Token:
        token = self._current
        if token.kind != kind or (value is not None and token.value != value):
            raise ExpressionError(
                f"Expected {value or kind.name} but found {token.value!r} at position {token.position}."
            )
        return self._advance()

    def parse(self) -> Node:
        node = self._parse_or()
        self._expect(TokenKind.EOF)
        return node

    def _parse_or(self) -> Node:
        node = self._parse_and()
        while self._current.kind == TokenKind.IDENT and self._current.value == "or":
            self._advance()
            node = BinaryOp(op="or", left=node, right=self._parse_and())
        return node

    def _parse_and(self) -> Node:
        node = self._parse_not()
        while self._current.kind == TokenKind.IDENT and self._current.value == "and":
            self._advance()
            node = BinaryOp(op="and", left=node, right=self._parse_not())
        return node

    def _parse_not(self) -> Node:
        if self._current.kind == TokenKind.IDENT and self._current.value == "not":
            self._advance()
            self._expect(TokenKind.LPAREN)
            operand = self._parse_or()
            self._expect(TokenKind.RPAREN)
            return UnaryOp(op="not", operand=operand)
        return self._parse_comparison()

    def _parse_comparison(self) -> Node:
        node = self._parse_additive()
        if self._current.kind == TokenKind.OP and self._current.value in _COMPARISON_OPS:
            op = self._advance().value
            op = "=" if op == "==" else op
            node = BinaryOp(op=op, left=node, right=self._parse_additive())
        return node

    def _parse_additive(self) -> Node:
        node = self._parse_multiplicative()
        while self._current.kind == TokenKind.OP and self._current.value in _ADDITIVE_OPS:
            op = self._advance().value
            node = BinaryOp(op=op, left=node, right=self._parse_multiplicative())
        return node

    def _parse_multiplicative(self) -> Node:
        node = self._parse_unary()
        while (self._current.kind == TokenKind.OP and self._current.value in _MULTIPLICATIVE_OPS) or (
            self._current.kind == TokenKind.IDENT and self._current.value == "mod"
        ):
            op = self._advance().value
            node = BinaryOp(op=op, left=node, right=self._parse_unary())
        return node

    def _parse_unary(self) -> Node:
        if self._current.kind == TokenKind.OP and self._current.value == "-":
            self._advance()
            return UnaryOp(op="-", operand=self._parse_unary())
        return self._parse_atom()

    def _parse_atom(self) -> Node:
        token = self._current

        if token.kind == TokenKind.NUMBER:
            self._advance()
            return Literal(value=float(token.value) if "." in token.value else int(token.value))

        if token.kind == TokenKind.STRING:
            self._advance()
            return Literal(value=token.value[1:-1].replace("\\'", "'").replace('\\"', '"'))

        if token.kind == TokenKind.REFERENCE:
            self._advance()
            path = token.value[2:-1]  # strip ${ and }
            escapes = path.startswith("../")
            return Reference(path=path[3:] if escapes else path, escapes_repeat=escapes)

        if token.kind == TokenKind.DOT:
            self._advance()
            return DotValue()

        if token.kind == TokenKind.LPAREN:
            self._advance()
            node = self._parse_or()
            self._expect(TokenKind.RPAREN)
            return node

        if token.kind == TokenKind.IDENT:
            if token.value == "true":
                self._advance()
                return Literal(value=True)
            if token.value == "false":
                self._advance()
                return Literal(value=False)
            if token.value == "null":
                self._advance()
                return Literal(value=None)
            # A bare identifier followed by `(` is a function call.
            name = self._advance().value
            self._expect(TokenKind.LPAREN)
            args = []
            if self._current.kind != TokenKind.RPAREN:
                args.append(self._parse_or())
                while self._current.kind == TokenKind.COMMA:
                    self._advance()
                    args.append(self._parse_or())
            self._expect(TokenKind.RPAREN)
            return FunctionCall(name=name, args=args)

        raise ExpressionError(f"Unexpected token {token.value!r} at position {token.position}.")


def parse(expression: str) -> Node:
    return Parser(tokenize(expression)).parse()
