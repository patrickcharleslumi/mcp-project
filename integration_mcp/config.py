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

    # Server settings
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE")
    tool_timeout_seconds: int = Field(default=30, alias="TOOL_TIMEOUT_SECONDS")

    # Feature flags
    enable_signing_likelihood: bool = Field(default=True, alias="ENABLE_SIGNING_LIKELIHOOD")

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

