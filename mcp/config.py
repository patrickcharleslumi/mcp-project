"""Configuration for MCP HTTP wrapper."""

from __future__ import annotations

from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class McpConfig(BaseSettings):
    """Application configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        env_file_encoding="utf-8",
    )

    # MCP API auth
    mcp_api_key: str = Field(..., alias="MCP_API_KEY")

    # Luminance API
    luminance_base_url: str = Field(..., alias="LUMINANCE_BASE_URL")
    luminance_api_token: str = Field(..., alias="LUMINANCE_API_TOKEN")
    luminance_project_id: int = Field(..., alias="LUMINANCE_PROJECT_ID")
    luminance_verify_tls: bool = Field(default=True, alias="MCP_VERIFY_TLS")

    # Server settings
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    request_timeout_seconds: int = Field(default=30, alias="MCP_REQUEST_TIMEOUT_SECONDS")
    rate_limit_per_minute: int = Field(default=120, alias="RATE_LIMIT_PER_MINUTE")
    max_concurrency: int = Field(default=6, alias="MCP_MAX_CONCURRENCY")
    max_clauses_per_document: int = Field(default=25, alias="MCP_MAX_CLAUSES_PER_DOCUMENT")
    max_documents_scan: int = Field(default=30, alias="MCP_MAX_DOCUMENTS_SCAN")
    circuit_breaker_threshold: int = Field(default=5, alias="MCP_CIRCUIT_BREAKER_THRESHOLD")
    circuit_breaker_reset_seconds: int = Field(default=30, alias="MCP_CIRCUIT_BREAKER_RESET_SECONDS")

    # Cache settings
    cache_ttl_seconds: int = Field(default=300, alias="MCP_CACHE_TTL_SECONDS")
    cache_max_entries: int = Field(default=2048, alias="MCP_CACHE_MAX_ENTRIES")

    # Feature flags
    feature_enabled: bool = Field(default=True, alias="MCP_FEATURE_ENABLED")

    # LLM Proxy (agentic layer)
    llm_proxy_enabled: bool = Field(default=False, alias="LLM_PROXY_ENABLED")
    llm_proxy_base_url: Optional[str] = Field(default=None, alias="LLM_PROXY_BASE_URL")
    llm_proxy_api_key: Optional[str] = Field(default=None, alias="LLM_PROXY_API_KEY")
    llm_proxy_model: str = Field(default="luminance-criteria", alias="LLM_PROXY_MODEL")
    llm_proxy_env: Optional[str] = Field(default=None, alias="LLM_PROXY_ENV")
    llm_proxy_request_purpose: str = Field(
        default="msa_optimization",
        alias="LLM_PROXY_REQUEST_PURPOSE",
    )
    llm_proxy_provider_allowlist: Optional[str] = Field(
        default=None,
        alias="LLM_PROXY_PROVIDER_ALLOWLIST",
    )
    llm_proxy_fastlane: bool = Field(default=False, alias="LLM_PROXY_FASTLANE")
    llm_proxy_timeout_seconds: int = Field(default=30, alias="LLM_PROXY_TIMEOUT_SECONDS")

    # Template catalog fallback (optional)
    template_catalog_path: Optional[str] = Field(default=None, alias="MCP_TEMPLATE_CATALOG_PATH")

    # Salesforce MCP (optional)
    salesforce_mcp_enabled: bool = Field(default=False, alias="SALESFORCE_MCP_ENABLED")
    salesforce_mcp_endpoint: Optional[str] = Field(default=None, alias="SALESFORCE_MCP_ENDPOINT")


config = McpConfig()
