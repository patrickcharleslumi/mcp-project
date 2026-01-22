from mcp.utils.text import normalize_text


def test_normalize_text_expands_abbreviations():
    text = "This MSA includes T&Cs."
    assert "master services agreement" in normalize_text(text)
    assert "terms and conditions" in normalize_text(text)
