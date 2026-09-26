"""
Turns an uploaded consent document (PDF/DOCX/TXT) into plain text -- the
same technique a sibling app's consent module uses (crediqs's
apps/consent/tasks.py): DOCX via `python-docx`, PDF via `pypdf`, TXT read
directly. No OCR, no background task queue -- this app's notices are a
paragraph or two of legal text, not scanned paperwork, so a synchronous
extraction on upload is simple and fast enough.
"""
import io

from django.core.exceptions import ValidationError

_SUPPORTED_EXTENSIONS = {"pdf", "docx", "txt"}


class DocumentExtractionError(ValidationError):
    pass


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()


def _extract_docx(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())


def extract_text(uploaded_file) -> str:
    """`uploaded_file` is a Django `UploadedFile` (from request.FILES).
    Raises `DocumentExtractionError` for an unsupported extension or a file
    that fails to parse -- the caller should surface that as a 400, not a
    500, since it's a bad upload, not a server fault."""
    name = uploaded_file.name or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in _SUPPORTED_EXTENSIONS:
        raise DocumentExtractionError(
            f"Unsupported file type '.{ext}' -- upload a PDF, DOCX or TXT file."
        )

    data = uploaded_file.read()
    uploaded_file.seek(0)  # the caller still needs to save the original file afterward

    try:
        if ext == "pdf":
            text = _extract_pdf(data)
        elif ext == "docx":
            text = _extract_docx(data)
        else:
            text = data.decode("utf-8", errors="replace")
    except Exception as exc:
        raise DocumentExtractionError(f"Couldn't read this file: {exc}") from exc

    text = text.strip()
    if not text:
        raise DocumentExtractionError("No readable text was found in this file.")
    return text
