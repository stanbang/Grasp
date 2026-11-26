from io import BytesIO
from typing import NamedTuple

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .parsing import MAX_PAGES

IMAGE_FORMATS = {
    ".png": ("PNG", "image/png"),
    ".jpg": ("JPEG", "image/jpeg"),
    ".jpeg": ("JPEG", "image/jpeg"),
    ".webp": ("WEBP", "image/webp"),
}
DOCUMENT_MEDIA = {".pdf": "application/pdf", ".md": "text/plain", ".txt": "text/plain"}
MAX_IMAGE_DIMENSION = 8192
MAX_IMAGE_PIXELS = 16_000_000
PREVIEW_DIMENSION = 1280


class ImagePreview(NamedTuple):
    content: bytes
    width: int
    height: int
    orientation: int


def image_preview(content: bytes, expected_format: str) -> ImagePreview:
    try:
        with Image.open(BytesIO(content), formats=[expected_format]) as source:
            width, height = source.size
            if max(width, height) > MAX_IMAGE_DIMENSION or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(413, "Use an image with at most 16 million pixels and 8,192 pixels on either side.")
            if getattr(source, "is_animated", False):
                raise HTTPException(415, "Use a single-frame image.")
            source.verify()
        with Image.open(BytesIO(content), formats=[expected_format]) as source:
            orientation = source.getexif().get(274, 1)
            if orientation not in range(1, 9):
                orientation = 1
            source.load()
            with ImageOps.exif_transpose(source) as upright:
                width, height = upright.size
                upright.thumbnail((PREVIEW_DIMENSION, PREVIEW_DIMENSION))
                with upright.convert("RGBA" if upright.has_transparency_data else "RGB") as preview:
                    preview.info.clear()
                    output = BytesIO()
                    preview.save(output, format="WEBP", quality=85)
                    return ImagePreview(output.getvalue(), width, height, orientation)
    except Image.DecompressionBombError as error:
        raise HTTPException(413, "Use an image with at most 16 million pixels and 8,192 pixels on either side.") from error
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, TypeError) as error:
        raise HTTPException(422, "The image is corrupt or its bytes do not match the file extension.") from error


def document_pages(content: bytes, extension: str) -> int:
    if extension != ".pdf":
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise HTTPException(422, "Save Markdown and text files as UTF-8 before importing.") from error
        if "\x00" in text:
            raise HTTPException(422, "The text file contains null characters.")
        return 1
    try:
        if not content.startswith(b"%PDF-"):
            raise HTTPException(422, "The file does not have a PDF header.")
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted:
            raise HTTPException(422, "Import an unlocked PDF.")
        pages = len(reader.pages)
        if not 1 <= pages <= MAX_PAGES:
            raise HTTPException(422, f"Use a PDF with 1 to {MAX_PAGES} pages.")
        return pages
    except (PdfReadError, OSError, ValueError, KeyError, TypeError, RecursionError) as error:
        raise HTTPException(422, "The PDF could not be opened.") from error
