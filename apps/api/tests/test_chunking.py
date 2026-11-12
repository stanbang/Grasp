from pathlib import Path

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.parsing import DocumentInputError, SourcePage, chunk_pages, read_pages


@pytest.mark.parametrize("text", [
    "  First paragraph.\r\n\r\nSecond paragraph with café and 🧠.  " * 12,
    "repeat repeat repeat\n" * 80,
    "漢字と記憶🧠" * 100,
    "word " * 200,
])
def test_chunk_offsets_are_exact_and_cover_nonwhitespace_text(text: str) -> None:
    chunks = chunk_pages([SourcePage(docId="doc", page=1, text=text)], size=100, overlap=25)
    covered: set[int] = set()
    for chunk in chunks:
        assert text[chunk.charStart:chunk.charEnd] == chunk.text
        assert len(chunk.text) <= 100
        assert chunk.docId == "doc" and chunk.page == 1
        covered.update(range(chunk.charStart, chunk.charEnd))
    assert all(index in covered for index, character in enumerate(text) if not character.isspace())
    assert len({chunk.id for chunk in chunks}) == len(chunks)


def test_chunks_preserve_page_boundaries_and_overlap() -> None:
    pages = [SourcePage(docId="d", page=index, text="abcde " * 50) for index in (1, 2)]
    chunks = chunk_pages(pages, size=100, overlap=30)
    assert {chunk.page for chunk in chunks} == {1, 2}
    for number in (1, 2):
        page_chunks = [chunk for chunk in chunks if chunk.page == number]
        assert page_chunks[0].charStart == 0
        assert page_chunks[1].charStart < page_chunks[0].charEnd


def test_text_decoding_preserves_crlf_and_unicode(tmp_path: Path) -> None:
    path = tmp_path / "note.txt"
    text = "café 🧠\r\nsecond line\r\n"
    path.write_bytes(b"\xef\xbb\xbf" + text.encode("utf-8"))
    assert read_pages(path, "d")[0].text == text


@pytest.mark.parametrize("content", [b"\xff\xfeinvalid", b"   ", b"has\x00null"])
def test_unreadable_text_has_an_actionable_error(tmp_path: Path, content: bytes) -> None:
    path = tmp_path / "note.txt"
    path.write_bytes(content)
    with pytest.raises(DocumentInputError):
        read_pages(path, "d")


def write_pdf(path: Path, texts: list[str]) -> None:
    writer = PdfWriter()
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    for text in texts:
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


def test_pdf_loader_converts_to_one_based_pages(tmp_path: Path) -> None:
    path = tmp_path / "notes.pdf"
    write_pdf(path, ["Working memory holds information.", "Retrieval practice recalls information."])
    pages = read_pages(path, "d")
    assert [page.page for page in pages] == [1, 2]
    assert pages[0].text.startswith("Working memory")
    assert pages[1].text.startswith("Retrieval practice")
    for chunk in chunk_pages(pages):
        assert pages[chunk.page - 1].text[chunk.charStart:chunk.charEnd] == chunk.text


def test_scanned_pdf_requires_ocr(tmp_path: Path) -> None:
    path = tmp_path / "scan.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.write(path)
    with pytest.raises(DocumentInputError, match="OCR"):
        read_pages(path, "d")
