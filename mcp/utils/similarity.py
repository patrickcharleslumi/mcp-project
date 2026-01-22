"""Similarity scoring utilities."""

from __future__ import annotations

from difflib import SequenceMatcher

from mcp.utils.text import normalize_text


def jaccard_similarity(a: str, b: str) -> float:
    """Compute Jaccard similarity on token sets."""
    tokens_a = set(normalize_text(a).split())
    tokens_b = set(normalize_text(b).split())
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / len(tokens_a | tokens_b)


def levenshtein_similarity(a: str, b: str) -> float:
    """Compute similarity ratio using SequenceMatcher."""
    return SequenceMatcher(None, normalize_text(a), normalize_text(b)).ratio()


def combined_similarity(a: str, b: str) -> float:
    """Combine multiple similarity metrics."""
    return round((jaccard_similarity(a, b) * 0.45 + levenshtein_similarity(a, b) * 0.55), 4)
