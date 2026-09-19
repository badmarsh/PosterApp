#!/usr/bin/env python3
"""Generates tests/fixtures/test.pdf — a real, minimal, one-page PDF.

Committed alongside the binary so the pdf-fallback-parser tests have a stable
fixture that does not depend on any external tool. Regenerate with:
    python3 tests/fixtures/generate-test-pdf.py
(pure stdlib; writes Helvetica text via a Type1 base font, no embedding)
"""
import os

def make_pdf(path: str) -> None:
    lines = [
        b"Sample Thesis Test Document",
        b"This is page one of the sample thesis fixture.",
        b"Methodology and experimental evaluation are discussed here.",
        b"Page 1 of 1",
    ]
    text_ops = b"BT /F1 14 Tf 72 720 Td 22 TL\n"
    for line in lines:
        escaped = line.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
        text_ops += b"(" + escaped + b") Tj T*\n"
    text_ops += b"ET"

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
         b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
        b"<< /Length " + str(len(text_ops)).encode() + b" >>\nstream\n" + text_ops + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n"
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (b"trailer\n<< /Size " + str(len(objects) + 1).encode() +
            b" /Root 1 0 R >>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF\n")

    with open(path, "wb") as f:
        f.write(bytes(out))
    print(f"wrote {path} ({len(out)} bytes)")

if __name__ == "__main__":
    make_pdf(os.path.join(os.path.dirname(__file__), "test.pdf"))
