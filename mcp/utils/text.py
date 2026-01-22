"""Text normalization utilities."""

from __future__ import annotations

import re

ABBREVIATIONS = {
    "t&cs": "terms and conditions",
    "tcs": "terms and conditions",
    "msa": "master services agreement",
    "nda": "non disclosure agreement",
}


def normalize_text(text: str) -> str:
    """Normalize text for comparison and similarity checks."""
    cleaned = text.lower().strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[“”]", '"', cleaned)
    cleaned = re.sub(r"[’]", "'", cleaned)
    for key, value in ABBREVIATIONS.items():
        cleaned = cleaned.replace(key, value)
    cleaned = re.sub(r"\s*([,.;:])\s*", r" \1 ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()
