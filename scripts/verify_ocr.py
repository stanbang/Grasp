"""Create an image-only PDF and verify the deployed OCR ingestion path."""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import httpx
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, NumberObject, DecodedStreamObject


def scanned_fixture(folder: Path) -> Path:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    content = DecodedStreamObject()
    content.set_data(b"BT /F1 22 Tf 50 700 Td (Retrieval practice) Tj 0 -40 Td /F1 16 Tf (Recall an idea before looking at the answer.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(content)
    text_pdf = folder / "text.pdf"
    writer.write(text_pdf)
    subprocess.run(["pdftoppm", "-singlefile", "-scale-to", "1400", str(text_pdf), str(folder / "raster")], check=True, capture_output=True)
    pixels = (folder / "raster.ppm").read_bytes()
    header = re.match(rb"P6\s+(\d+)\s+(\d+)\s+255\s", pixels)
    assert header is not None
    image = DecodedStreamObject()
    image.set_data(pixels[header.end():])
    image.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"), NameObject("/Width"): NumberObject(int(header[1])), NameObject("/Height"): NumberObject(int(header[2])), NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8)})
    scan = PdfWriter()
    page = scan.add_blank_page(width=612, height=792)
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): DictionaryObject({NameObject("/Image"): scan._add_object(image.flate_encode())})})
    content = DecodedStreamObject()
    content.set_data(b"q 612 0 0 792 0 0 cm /Image Do Q")
    page[NameObject("/Contents")] = scan._add_object(content)
    path = folder / "scanned-study-note.pdf"
    scan.write(path)
    assert not PdfReader(path).pages[0].extract_text().strip()
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080/api")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="grasp-scan-") as directory:
        path = scanned_fixture(Path(directory))
        with httpx.Client(base_url=args.base_url, timeout=180, trust_env=False) as client:
            response = client.post("/documents", files={"file": (path.name, path.read_bytes(), "application/pdf")})
            response.raise_for_status()
            doc_id = response.json()["id"]
            events = client.get(f"/documents/{doc_id}/events")
            events.raise_for_status()
            assert client.get(f"/documents/{doc_id}").json()["status"] == "done"
            page = client.get(f"/documents/{doc_id}/pages/1").json()["text"]
            assert "retrieval practice" in page.lower() and "answer" in page.lower()
            chunks = client.get(f"/documents/{doc_id}/chunks").json()["chunks"]
            assert chunks and all(page[c["charStart"]:c["charEnd"]] == c["text"] for c in chunks)
    report = {"imageOnlyInput": True, "nativeOcr": True, "exactOffsets": True, "chunks": len(chunks), "recognizedText": page}
    if args.output:
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
