from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject


def fixture_image(path: Path, dimensions: tuple[int, int]) -> None:
    with Image.new("RGB", dimensions, "#24354c") as image:
        draw = ImageDraw.Draw(image)
        width, height = dimensions
        draw.rectangle((width // 8, height // 6, width * 3 // 8, height * 5 // 6), fill="#91b88a")
        draw.ellipse((width // 2, height // 4, width * 7 // 8, height * 3 // 4), fill="#e0bc99")
        image.save(path)


def fixture_pdf(path: Path) -> None:
    writer = PdfWriter()
    font = writer._add_object(DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    }))
    for line in ("The first page is the overview.", "The second page explains the fixture sensor."):
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
        })
        content = DecodedStreamObject()
        content.set_data(f"BT /F1 12 Tf 72 720 Td ({line}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(content)
    writer.write(path)


def main() -> None:
    parser = ArgumentParser(description="Create synthetic Milestone A acceptance files.")
    parser.add_argument("directory", type=Path)
    target = parser.parse_args().directory
    target.mkdir(parents=True, exist_ok=True)
    for name, dimensions in (
        ("wide.png", (420, 230)), ("portrait.jpg", (200, 360)), ("shapes.webp", (280, 200)),
    ):
        fixture_image(target / name, dimensions)
    fixture_pdf(target / "two-pages.pdf")
    (target / "notes.md").write_text("# Fixture sensor\n\nThe sensor measures light.\n", encoding="utf-8")
    (target / "notes.txt").write_text("The acceptance fixture uses a synthetic image.\n", encoding="utf-8")
    (target / "corrupt.png").write_bytes(b"This fixture is deliberately not an image.")
    (target / "unsupported.svg").write_text("<svg/>", encoding="utf-8")
    print(target.resolve())


if __name__ == "__main__":
    main()
