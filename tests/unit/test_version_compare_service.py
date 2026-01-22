import pytest

from mcp.services.version_compare import VersionCompareService
from conftest import FakeLuminanceClient


@pytest.mark.asyncio
async def test_version_compare_returns_changes():
    service = VersionCompareService(FakeLuminanceClient())
    result = await service.compare(group_id=123, base_document_id=None, compare_document_id=None, request_id="req")
    assert "diffSummary" in result
    assert "changedClauses" in result
