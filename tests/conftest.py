from __future__ import annotations

import importlib
import os

import pytest

os.environ.setdefault("MCP_API_KEY", "test-key")
os.environ.setdefault("LUMINANCE_BASE_URL", "https://example.test")
os.environ.setdefault("LUMINANCE_API_TOKEN", "token")
os.environ.setdefault("LUMINANCE_PROJECT_ID", "1")


class FakeLuminanceClient:
    def __init__(self) -> None:
        self.closed = False

    async def close(self) -> None:
        self.closed = True

    async def get_document(self, project_id: int, document_id: int, request_id=None):
        return {"id": document_id, "updated_at": "2026-01-20T12:00:00Z"}

    async def get_document_annotations(self, project_id: int, document_id: int, params=None, request_id=None):
        if params and params.get("id"):
            return [{"id": params["id"], "content": {"text": "Payment terms apply."}, "path": "payment"}]
        return [
            {"id": 1, "content": {"text": "Payment terms apply."}, "path": "payment"},
            {"id": 2, "content": {"text": "Liability capped at 12 months."}, "path": "liability"},
        ]

    async def get_annotation_text(self, project_id: int, document_id: int, annotation_id: int, request_id=None):
        return {"text": f"Annotation {annotation_id} text."}

    async def get_matter(self, project_id: int, matter_id: int, request_id=None):
        return {"id": matter_id, "name": "Matter", "state": "active", "info": {"governing_law": "England"}}

    async def get_matter_annotations(self, project_id: int, matter_id: int, request_id=None):
        return [{"id": 10, "annotation_type": {"key": "priority"}, "content": "high"}]

    async def get_matter_versions(self, project_id: int, matter_id: int, request_id=None):
        return [
            {"id": 1, "document_id": 100, "created_at": "2026-01-01T00:00:00Z"},
            {"id": 2, "document_id": 101, "created_at": "2026-01-02T00:00:00Z"},
        ]

    async def list_documents(self, project_id: int, params=None, request_id=None):
        return [
            {"id": 201, "matter_id": 123},
            {"id": 202, "matter_id": 123},
        ]

    async def list_tasks(self, project_id: int, request_id=None):
        return [
            {"document_template_id": "tmpl-1", "name": "NDA Template", "fields": []},
        ]


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("MCP_API_KEY", "test-key")
    monkeypatch.setenv("LUMINANCE_BASE_URL", "https://example.test")
    monkeypatch.setenv("LUMINANCE_API_TOKEN", "token")
    monkeypatch.setenv("LUMINANCE_PROJECT_ID", "1")

    import mcp.config
    import mcp.app

    importlib.reload(mcp.config)
    importlib.reload(mcp.app)
    monkeypatch.setattr(mcp.app, "LuminanceClient", FakeLuminanceClient)

    return mcp.app.create_app()
