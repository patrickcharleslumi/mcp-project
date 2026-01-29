#!/usr/bin/env python3
"""Generate a Salesforce JWT and exchange for an access token."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def _require_env(name: str) -> str:
    value = _env(name)
    if not value:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def _read_private_key(path: str) -> str:
    if not os.path.exists(path):
        print(f"Private key not found: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as handle:
        key = handle.read().strip()
    if "BEGIN PRIVATE KEY" not in key:
        print("Private key is not PKCS#8. Convert with:", file=sys.stderr)
        print("  openssl pkcs8 -topk8 -nocrypt -in salesforce.key -out salesforce.pk8", file=sys.stderr)
        sys.exit(1)
    return key


def _build_jwt(client_id: str, username: str, audience: str, private_key: str) -> str:
    try:
        import jwt  # type: ignore
    except Exception:
        print("Missing dependency: pyjwt. Install with `pip install pyjwt`.", file=sys.stderr)
        sys.exit(1)

    payload = {
        "iss": client_id,
        "sub": username,
        "aud": audience,
        "exp": int(time.time()) + 300,
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def _post_token(token_url: str, assertion: str) -> dict:
    body = urllib.parse.urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        token_url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        print(raw, file=sys.stderr)
        raise SystemExit(exc.code)
    return json.loads(raw)


def main() -> None:
    username = _require_env("SF_USERNAME")
    client_id = _require_env("SF_CLIENT_ID")
    token_url = _require_env("SF_TOKEN_URL")
    audience = _env("SF_AUD") or token_url.replace("/services/oauth2/token", "")
    key_path = _require_env("SF_PRIVATE_KEY_PATH")

    private_key = _read_private_key(key_path)
    assertion = _build_jwt(client_id, username, audience, private_key)
    token_payload = _post_token(token_url, assertion)
    print(json.dumps(token_payload, indent=2))


if __name__ == "__main__":
    main()
