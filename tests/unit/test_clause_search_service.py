import pytest

from mcp.services.clause_search import ClauseSearchService
from conftest import FakeLuminanceClient


@pytest.mark.asyncio
async def test_clause_search_returns_results():
    service = ClauseSearchService(FakeLuminanceClient())
    result = await service.search(
        group_id=123,
        clause_id="1",
        clause_text=None,
        filters={},
        limit=5,
        request_id="req",
    )
    assert "similarClauses" in result
