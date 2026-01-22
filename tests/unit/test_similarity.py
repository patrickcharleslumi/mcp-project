from mcp.utils.similarity import combined_similarity


def test_combined_similarity_scores_overlap():
    score = combined_similarity("Payment within 30 days", "Payment due within thirty days")
    assert score > 0.4
