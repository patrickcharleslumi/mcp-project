from mcp.utils.diffing import diff_score, explain_diff


def test_diff_score_detects_change():
    score = diff_score("Payment within 30 days", "Payment within 60 days")
    assert score < 1.0


def test_explain_diff_returns_summary():
    explanation = explain_diff("Payment within 30 days", "Payment within 60 days")
    assert "Added terms" in explanation or "Removed terms" in explanation
