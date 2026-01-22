"""Compatibility shim for Salesforce MCP client import path."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any

_MODULE_PATH = Path(__file__).resolve().parents[1] / "components" / "salesforce-mcp" / "salesforce_mcp_client.py"


def _load_salesforce_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("salesforce_mcp_client", _MODULE_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load Salesforce MCP client from {_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[call-arg]
    return module


_module: ModuleType | None = None


def _get_module() -> ModuleType:
    global _module
    if _module is None:
        _module = _load_salesforce_module()
    return _module


def __getattr__(name: str) -> Any:
    module = _get_module()
    return getattr(module, name)


__all__ = ["SalesforceMcpClient"]
