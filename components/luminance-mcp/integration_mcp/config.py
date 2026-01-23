"""Configuration management for the MCP server."""

import os
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Config(BaseSettings):
    """Application configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        env_file_encoding="utf-8",
    )

    # Luminance API
    luminance_base_url: str = Field(..., alias="LUMINANCE_BASE_URL")
    luminance_api_token: str = Field(..., alias="LUMINANCE_API_TOKEN")
    luminance_verify_tls: bool = Field(default=True, alias="LUMINANCE_VERIFY_TLS")

    # Server settings
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE")
    tool_timeout_seconds: int = Field(default=30, alias="TOOL_TIMEOUT_SECONDS")

    # Feature flags
    enable_signing_likelihood: bool = Field(default=True, alias="ENABLE_SIGNING_LIKELIHOOD")

    # LLM Proxy configuration (optional)
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
    llm_proxy_timeout_seconds: int = Field(
        default=30,
        alias="LLM_PROXY_TIMEOUT_SECONDS",
    )

    # Prismatic Configuration (optional, for Prismatic-hosted deployment)
    prismatic_api_key: Optional[str] = Field(default=None, alias="PRISMATIC_API_KEY")
    prismatic_base_url: str = Field(
        default="https://app.prismatic.io", alias="PRISMATIC_BASE_URL"
    )
    prismatic_region: Optional[str] = Field(default=None, alias="PRISMATIC_REGION")

    # Salesforce MCP Configuration (optional, for company context enrichment)
    salesforce_mcp_enabled: bool = Field(default=False, alias="SALESFORCE_MCP_ENABLED")
    salesforce_mcp_endpoint: Optional[str] = Field(
        default=None, alias="SALESFORCE_MCP_ENDPOINT"
    )


# Global config instance
config = Config()

