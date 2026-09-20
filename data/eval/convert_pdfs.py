
import sys
import os
import re
import json
import hashlib

try:
    from pypdf import PdfReader
except ImportError:
    from PyPDF2 import PdfReader

def pdf_to_markdown(pdf_path, doc_id):
    reader = PdfReader(pdf_path)
    sections = []
    current_heading = "Preamble"
    current_text = []
    
    for page_num, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            text = f"[Page {page_num+1} extraction failed: {e}]"
        
        # Split by lines and detect headings
        lines = text.split("\n")
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            # Simple heading detection: short lines that look like section headers
            # (all caps, or numbered like "1.", "2.1", etc., or known section names)
            is_heading = (
                len(stripped) < 80 and (
                    re.match(r'^[0-9]+\.\s+[A-Z]', stripped) or
                    re.match(r'^[0-9]+\.[0-9]+\.?\s+[A-Z]', stripped) or
                    stripped.upper() == stripped and len(stripped) > 3 and len(stripped.split()) <= 8 or
                    stripped in ['Abstract', 'Introduction', 'Conclusion', 'Conclusions', 
                                 'References', 'Acknowledgments', 'Related Work',
                                 'Background', 'Methods', 'Results', 'Discussion',
                                 'Experiments', 'Evaluation', 'Appendix']
                )
            )
            if is_heading and len(current_text) > 0:
                sections.append((current_heading, " ".join(current_text)))
                current_heading = stripped
                current_text = []
            else:
                current_text.append(stripped)
    
    if current_text:
        sections.append((current_heading, " ".join(current_text)))
    
    # Build markdown
    md_lines = []
    for heading, content in sections:
        md_lines.append(f"# {heading}")
        md_lines.append("")
        # Wrap at ~80 chars
        words = content.split()
        line_buf = []
        for w in words:
            line_buf.append(w)
            if len(" ".join(line_buf)) > 500:
                md_lines.append(" ".join(line_buf))
                line_buf = []
        if line_buf:
            md_lines.append(" ".join(line_buf))
        md_lines.append("")
    
    return "\n".join(md_lines)

pdfs = [
    ("data/eval/pdfs/transformer-paper.pdf", "transformer-2017", "Attention Is All You Need (Vaswani et al., 2017)"),
    ("data/eval/pdfs/bert-paper.pdf", "bert-2018", "BERT: Pre-training of Deep Bidirectional Transformers (Devlin et al., 2018)"),
    ("data/eval/pdfs/llm-survey-phd.pdf", "llm-survey-2023", "A Survey of Large Language Models (Zhao et al., 2023)"),
]

os.makedirs("data/eval/corpus", exist_ok=True)

manifest = []
for pdf_path, doc_id, title in pdfs:
    print(f"Processing {pdf_path}...")
    try:
        md = pdf_to_markdown(pdf_path, doc_id)
        out_path = f"data/eval/corpus/{doc_id}.md"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(f"---\ndocId: {doc_id}\ntitle: {title}\n---\n\n")
            f.write(md)
        size = os.path.getsize(out_path)
        word_count = len(md.split())
        print(f"  -> {out_path} ({size} bytes, {word_count} words)")
        manifest.append({"docId": doc_id, "title": title, "path": out_path, "words": word_count})
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback; traceback.print_exc()

with open("data/eval/corpus/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("\nManifest written. Done.")

