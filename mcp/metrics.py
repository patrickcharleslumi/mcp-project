"""Metrics hooks."""

from __future__ import annotations

from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter("mcp_requests_total", "Total MCP requests", ["endpoint", "status"])
REQUEST_LATENCY = Histogram("mcp_request_latency_seconds", "MCP request latency", ["endpoint"])
