"""
File-type detection by leading bytes rather than trusting an extension or a
declared content type, plus the CSV/export safety helpers. Survey answers
are arbitrary respondent text that ends up in an export a customer opens in
a spreadsheet -- defanging it is not optional.
"""
from rest_framework.exceptions import ValidationError

_MAGIC = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"%PDF-": "pdf",
    b"GIF87a": "gif",
    b"GIF89a": "gif",
}
_ZIP_MAGIC = b"PK\x03\x04"


def detect_file_kind(file_obj) -> str:
    head = file_obj.read(1024)
    file_obj.seek(0)
    for magic, kind in _MAGIC.items():
        if head.startswith(magic):
            return kind
    if head.startswith(_ZIP_MAGIC):
        # xlsx and docx share the ZIP magic byte; disambiguate by peeking
        # for the entry name each format always contains.
        file_obj.seek(0)
        blob = file_obj.read()
        file_obj.seek(0)
        if b"xl/workbook.xml" in blob:
            return "xlsx"
        if b"word/document.xml" in blob:
            return "docx"
        return "zip"
    try:
        head.decode("utf-8")
        return "csv"
    except UnicodeDecodeError:
        try:
            head.decode("latin-1")
            return "csv"
        except UnicodeDecodeError:
            return "unknown"


def validate_file_kind(file_obj, allowed: set[str]) -> str:
    kind = detect_file_kind(file_obj)
    if kind not in allowed:
        raise ValidationError("This file type is not permitted here.")
    return kind


_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value):
    """OWASP CSV-injection defence: a cell that could be read as a formula
    by a spreadsheet application is prefixed with an apostrophe."""
    if isinstance(value, str) and value.startswith(_DANGEROUS_PREFIXES):
        return "'" + value
    return value


def sanitize_error_payload(value):
    """Recursive version of the above, for structures such as per-row
    import errors that echo back user-entered cell values."""
    if isinstance(value, str):
        return sanitize_csv_cell(value)
    if isinstance(value, list):
        return [sanitize_error_payload(v) for v in value]
    if isinstance(value, dict):
        return {k: sanitize_error_payload(v) for k, v in value.items()}
    return value
