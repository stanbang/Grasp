from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field
from pypdf import PdfReader

from .schemas import Chunk

ALLOWED_EXTENSIONS = {".pdf", ".md", ".txt"}
MAX_PAGES = 250
MAX_CHARACTERS = 500_000


class DocumentInputError(ValueError):
    pass


class SourcePage(BaseModel):
    docId: str
    page: int = Field(ge=1)
    text: str


def read_pages(path: Path, doc_id: str, ocr_enabled: bool = False, ocr_language: str = "eng") -> list[SourcePage]:
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise DocumentInputError("Password-protected PDFs are not supported. Upload an unlocked copy.")
        if len(reader.pages) > MAX_PAGES:
            raise DocumentInputError(f"Use a PDF with at most {MAX_PAGES} pages.")
        loaded = PyPDFLoader(path, mode="page").load()
        pages = [SourcePage(docId=doc_id, page=item.metadata["page"] + 1, text=item.page_content) for item in loaded]
        if ocr_enabled:
            from .ocr import ocr_page
            for page in pages:
                if not page.text.strip():page.text=ocr_page(path,page.page,ocr_language)
    else:
        try:
            text = path.read_bytes().decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise DocumentInputError("Save Markdown and text files as UTF-8 before uploading.") from error
        pages = [SourcePage(docId=doc_id, page=1, text=text)]
    if sum(len(page.text) for page in pages) > MAX_CHARACTERS:
        raise DocumentInputError(f"Use a document with at most {MAX_CHARACTERS:,} extracted characters.")
    if any("\x00" in page.text for page in pages):
        raise DocumentInputError("The extracted text contains null characters. Export a clean text copy.")
    if not any(page.text.strip() for page in pages):
        raise DocumentInputError("No readable text was found. Scanned PDFs need OCR before upload.")
    return pages


def chunk_pages(pages: list[SourcePage], size: int = 900, overlap: int = 150) -> list[Chunk]:
    if not 0 <= overlap < size:
        raise ValueError("Chunk overlap must be non-negative and smaller than chunk size.")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size, chunk_overlap=overlap,
        add_start_index=True, strip_whitespace=False,
    )
    chunks: list[Chunk] = []
    for page in pages:
        documents = splitter.create_documents([page.text], [{"docId": page.docId, "page": page.page}])
        for item in documents:
            if not item.page_content.strip():
                continue
            start = item.metadata["start_index"]
            end = start + len(item.page_content)
            if start < 0 or page.text[start:end] != item.page_content:
                raise DocumentInputError("A chunk could not be matched to its source page.")
            chunks.append(Chunk(
                id=f"{page.docId}:p{page.page}:{start}-{end}",
                docId=page.docId, page=page.page, text=item.page_content,
                charStart=start, charEnd=end,
            ))
    return chunks
