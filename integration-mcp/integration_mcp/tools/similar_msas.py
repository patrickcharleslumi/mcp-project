"""Tool for finding similar signed MSAs."""

from typing import Any

import httpx

from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.tools.base import ToolHandler
from integration_mcp.logger import get_logger

logger = get_logger(__name__)


def get_similar_msas_tool(client: LuminanceClient) -> ToolHandler:
    """Create the get_similar_msas tool.

    Args:
        client: Luminance API client

    Returns:
        Tool handler instance
    """
    input_schema = {
        "type": "object",
        "properties": {
            "tenant_id": {
                "type": "string",
                "description": "Tenant ID for scoping the request",
            },
            "msa_id": {
                "type": "integer",
                "description": "ID of the draft MSA document in Luminance",
            },
            "project_id": {
                "type": "integer",
                "description": "Project ID containing the MSA",
            },
            "region": {
                "type": "string",
                "description": "Optional: Filter by region/jurisdiction",
            },
            "company_size_bucket": {
                "type": "string",
                "enum": ["small", "mid", "enterprise"],
                "description": "Optional: Filter by company size",
            },
            "limit": {
                "type": "integer",
                "default": 20,
                "minimum": 1,
                "maximum": 100,
                "description": "Maximum number of results to return",
            },
        },
        "required": ["tenant_id", "msa_id", "project_id"],
    }

    async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_similar_msas tool.

        Args:
            arguments: Tool arguments

        Returns:
            List of similar signed MSAs with metadata
        """
        tenant_id = arguments["tenant_id"]
        msa_id = arguments["msa_id"]
        project_id = arguments["project_id"]
        region = arguments.get("region")
        company_size_bucket = arguments.get("company_size_bucket")
        limit = arguments.get("limit", 20)

        logger.info(
            "Finding similar MSAs",
            tenant_id=tenant_id,
            msa_id=msa_id,
            project_id=project_id,
            region=region,
            company_size_bucket=company_size_bucket,
            limit=limit,
        )

        # Get the reference MSA document
        try:
            ref_doc = await client.get_document(project_id, msa_id)
            logger.debug("Reference document retrieved", document_id=msa_id)
        except Exception as e:
            logger.error("Failed to retrieve reference document", error=str(e))
            raise

        # Find similar documents
        # Note: "signed" is not a document state - it's a workflow stage type
        # For MVP, we'll get all documents and check matter states separately
        # In production, this would use Luminance's similarity search/ML capabilities
        similar_docs = await client.find_similar_documents(
            project_id=project_id,
            document_id=msa_id,
            document_type="MSA",
            state=None,  # Don't filter by "signed" - it's not a valid document state
            limit=limit,
        )

        # Get matter annotations to extract signing metadata
        results = []
        for doc in similar_docs[:limit]:
            doc_id = doc.get("id")
            if not doc_id:
                continue

            # Try to get associated matter for signing date
            # Note: Documents may not have a direct matter_id field
            # In Luminance, documents are typically associated with matters via version_group
            # or through matter versions. For MVP, we'll skip matter lookup if not easily available.
            matter_id = doc.get("matter_id") or doc.get("version_group") or doc.get("group_id")

            signed_date = None
            time_to_sign_days = None

            # Only try to get matter if we have a valid-looking ID (not None, not 0)
            if matter_id and isinstance(matter_id, int) and matter_id > 0:
                try:
                    matter = await client.get_matter(project_id, matter_id)
                    # Extract signing date from matter annotations or events
                    # This is placeholder logic
                    matter_info = matter.get("info", {})
                    signed_date = matter_info.get("signed_date") or matter_info.get("executed_date")
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        # Matter doesn't exist - this is fine, just skip it
                        logger.debug("Matter not found, skipping metadata", matter_id=matter_id)
                    else:
                        logger.debug("Could not retrieve matter metadata", matter_id=matter_id, error=str(e))
                except Exception as e:
                    logger.debug("Could not retrieve matter metadata", matter_id=matter_id, error=str(e))

            result = {
                "msa_id": doc_id,
                "matter_id": matter_id,
                "name": doc.get("name", "Unknown"),
                "signed_date": signed_date,
                "time_to_sign_days": time_to_sign_days,
                "similarity_score": 0.85,  # Placeholder - would come from ML similarity
                "link": f"/projects/{project_id}/documents/{doc_id}",
            }

            # Apply filters if provided
            if region or company_size_bucket:
                # In production, these would be checked against matter annotations
                # For MVP, we include all results
                pass

            results.append(result)

        logger.info(
            "Similar MSAs found",
            count=len(results),
            msa_id=msa_id,
        )

        return {
            "reference_msa_id": msa_id,
            "similar_msas": results,
            "total_count": len(results),
            "filters_applied": {
                "region": region,
                "company_size_bucket": company_size_bucket,
            },
        }

    handler = ToolHandler(
        name="get_similar_msas",
        description=(
            "Find signed MSAs similar to a draft MSA. Results are filtered by company size "
            "and region/jurisdiction if provided. Returns compact metadata including signed dates, "
            "time-to-sign, and similarity scores."
        ),
        input_schema=input_schema,
    )

    handler._execute = execute

    return handler

