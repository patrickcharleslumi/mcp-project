from fastapi.testclient import TestClient


def test_version_compare_endpoint(app):
    with TestClient(app) as client:
        response = client.post(
            "/mcp/groups/123/version-comparison",
            headers={"Authorization": "Bearer test-key"},
            json={"baseDocumentId": "100", "compareDocumentId": "101"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "success"


def test_clause_search_endpoint(app):
    with TestClient(app) as client:
        response = client.post(
            "/mcp/groups/123/clauses/search",
            headers={"Authorization": "Bearer test-key"},
            json={"clauseId": "1", "limit": 3},
        )
        assert response.status_code == 200


def test_group_info_endpoint(app):
    with TestClient(app) as client:
        response = client.get(
            "/mcp/groups/123/info",
            headers={"Authorization": "Bearer test-key"},
        )
        assert response.status_code == 200
