"""Cache utilities."""

from __future__ import annotations

from cachetools import TTLCache

from mcp.config import config


def build_cache() -> TTLCache:
    """Create a TTL cache based on configuration."""
    return TTLCache(maxsize=config.cache_max_entries, ttl=config.cache_ttl_seconds)
