#!/usr/bin/env python3
"""Compile a contributor's Manifesto from journals and ethics files."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from engine.soul_journal import get_entries

BASE_DIR = Path(__file__).resolve().parent
ETHICS_V1_PATH = BASE_DIR / "ethics" / "core.mdx"
ETHICS_V2_PATH = BASE_DIR / "ethics" / "core_v2.mdx"
ALIGN_CODE_PATH = BASE_DIR / "ethics" / "alignment_code_v2.mdx"


def _read_lines(path: Path) -> List[str]:
    if not path.exists():
        return []
    with open(path) as f:
        return [line.rstrip() for line in f]


def compile_manifesto(user_id: str, title: str, memory_tag: Optional[str] = None) -> dict:
    """Return manifesto dictionary for ``user_id``."""
    entries = [e.get("text", "") for e in get_entries(user_id)]
    manifesto = {
        "title": title,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "living_memory_cell": memory_tag,
        "journal_fragments": entries,
        "alignment_code": _read_lines(ALIGN_CODE_PATH),
        "ethics_v1": _read_lines(ETHICS_V1_PATH),
        "ethics_v2": _read_lines(ETHICS_V2_PATH),
    }
    return manifesto


def _build_text(data: dict) -> str:
    lines = [f"# {data['title']}", f"_Compiled {data['timestamp']}_", ""]
    tag = data.get("living_memory_cell")
    if tag:
        lines.append(f"**Living Memory Cell:** {tag}")
        lines.append("")
    lines.append("## Alignment Code")
    lines.extend(data.get("alignment_code", []))
    lines.append("")
    lines.append("## Ethics Framework v1.0")
    lines.extend(data.get("ethics_v1", []))
    lines.append("")
    lines.append("## Ethics Framework v2.0")
    lines.extend(data.get("ethics_v2", []))
    lines.append("")
    lines.append("## Journal Fragments")
    for frag in data.get("journal_fragments", []):
        lines.append(f"- {frag}")
    return "\n".join(lines)


def _simple_pdf(text: str) -> bytes:
    lines = text.splitlines()
    y = 750
    step = 14
    parts = ["BT", "/F1 12 Tf"]
    for line in lines:
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        parts.append(f"70 {y} Td ({safe}) Tj")
        y -= step
    parts.append("ET")
    stream = "\n".join(parts)
    objects: List[str] = []
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )
    objects.append(
        f"4 0 obj\n<< /Length {len(stream.encode())} >>\nstream\n{stream}\nendstream\nendobj\n"
    )
    objects.append("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    header = "%PDF-1.4\n"
    body = "".join(objects)
    xref_start = len(header.encode()) + len(body.encode())
    offsets = [0]
    current = 0
    for obj in objects:
        offsets.append(current)
        current += len(obj.encode())
    xref = ["xref", "0 6", "0000000000 65535 f \n"]
    for off in offsets[1:]:
        xref.append(f"{off:010d} 00000 n \n")
    trailer = f"trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n{xref_start}\n%%EOF"
    pdf = header + body + "\n".join(xref) + "\n" + trailer
    return pdf.encode()


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Compile Contributor Manifesto")
    parser.add_argument("user", help="User ID")
    parser.add_argument("--title", help="Custom title")
    parser.add_argument("--memory-tag", help="Living Memory Cell tag")
    parser.add_argument("--format", choices=["text", "pdf", "ipfs-json"], default="text")
    parser.add_argument("--output", help="Output file path")
    args = parser.parse_args(argv)

    title = args.title or f"{args.user} Contributor Manifesto"
    data = compile_manifesto(args.user, title, args.memory_tag)

    if args.format == "pdf":
        if not args.output:
            parser.error("--output required for pdf format")
        Path(args.output).write_bytes(_simple_pdf(_build_text(data)))
    elif args.format == "ipfs-json":
        text = json.dumps(data, indent=2)
        if args.output:
            Path(args.output).write_text(text)
        else:
            print(text)
    else:
        text = _build_text(data)
        if args.output:
            Path(args.output).write_text(text)
        else:
            print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
