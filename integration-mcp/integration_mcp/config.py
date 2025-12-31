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


# Global config instance
config = Config()

