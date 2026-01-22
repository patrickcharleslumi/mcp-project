"""Setup script for integration-mcp."""

from setuptools import find_packages, setup

setup(
    name="integration-mcp",
    version="0.1.0",
    description="MCP server for Luminance API semantic tools",
    packages=find_packages("components/luminance-mcp"),
    package_dir={"": "components/luminance-mcp"},
    python_requires=">=3.10",
    install_requires=[
        "mcp>=0.9.0",
        "httpx>=0.27.0",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "python-dotenv>=1.0.0",
        "structlog>=24.1.0",
        "tenacity>=8.2.3",
        "fastapi>=0.110.0",
        "uvicorn>=0.27.0",
        "cachetools>=5.3.2",
        "prometheus-client>=0.20.0",
    ],
    entry_points={
        "console_scripts": [
            "integration-mcp=integration_mcp.server:main",
            "luminance-mcp-http=mcp.server:main",
        ],
    },
)

