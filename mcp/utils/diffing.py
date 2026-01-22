"""Diffing utilities."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from mcp.utils.text import normalize_text


@dataclass
class ClauseDiff:
    clause_id: str
    path: str
    old_text: str
    new_text: str
    diff_score: float
    explanation: str


def diff_score(old_text: str, new_text: str) -> float:
    """Compute a diff score between two texts."""
    ratio = SequenceMatcher(None, normalize_text(old_text), normalize_text(new_text)).ratio()
    return round(ratio, 4)


def explain_diff(old_text: str, new_text: str) -> str:
    """Generate a short explanation of differences."""
    old_tokens = set(normalize_text(old_text).split())
    new_tokens = set(normalize_text(new_text).split())
    added = new_tokens - old_tokens
    removed = old_tokens - new_tokens
    if not added and not removed:
        return "No meaningful textual difference detected."
    explanation_parts = []
    if added:
        explanation_parts.append(f"Added terms: {', '.join(sorted(list(added))[:5])}")
    if removed:
        explanation_parts.append(f"Removed terms: {', '.join(sorted(list(removed))[:5])}")
    return " | ".join(explanation_parts)
