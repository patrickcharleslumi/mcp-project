import pytest

from mcp.services.group_info import GroupInfoService
from conftest import FakeLuminanceClient


@pytest.mark.asyncio
async def test_group_info_returns_tags():
    service = GroupInfoService(FakeLuminanceClient())
    result = await service.get_group_info(123, request_id="req")
    assert result["tags"]
