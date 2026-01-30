"""Salesforce context service for AI insights."""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from typing import Any, Optional

from mcp.clients.salesforce_mcp import SalesforceMcpClient
from mcp.config import config
from mcp.logging import get_logger

logger = get_logger(__name__)

# Simple cache for Salesforce data - TTL of 60 seconds
_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 60.0  # seconds


@dataclass(frozen=True)
class SalesforceOpportunity:
    opportunity_id: str
    opportunity_name: str
    stage_name: Optional[str]
    close_date: Optional[str]
    region: Optional[str]
    business_unit: Optional[str]
    acv: Optional[float]
    arr: Optional[float]
    discount: Optional[float]
    total_discount: Optional[float]
    payment_terms: Optional[str]
    legal_required: Optional[bool]
    security_review_required: Optional[bool]
    non_standard_terms_requested: Optional[bool]
    redline_count: Optional[int]
    main_competitors: Optional[str]
    procurement_pressure: Optional[str]
    procurement_category: Optional[str]
    contract_start_date: Optional[str]
    contract_end_date: Optional[str]
    renewal_date: Optional[str]
    renewal_notice_period: Optional[str]
    auto_renewal: Optional[bool]
    next_step: Optional[str]
    open_cases_count: Optional[int]
    max_open_case_severity: Optional[str]
    sla_breach: Optional[bool]
    customer_health: Optional[str]
    # Additional deal status fields
    is_closed: Optional[bool]
    is_won: Optional[bool]
    forecast_category: Optional[str]
    probability: Optional[float]
    expected_revenue: Optional[float]
    opportunity_type: Optional[str]
    lead_source: Optional[str]


def _parse_bool(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in ("true", "yes", "1"):
        return True
    if normalized in ("false", "no", "0"):
        return False
    return None


def _parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    cleaned = value.strip().replace(",", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_int(value: Optional[str]) -> Optional[int]:
    number = _parse_float(value)
    return int(number) if number is not None else None


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _cache_get(key: str) -> Optional[Any]:
    """Get item from cache if not expired."""
    if key in _CACHE:
        timestamp, value = _CACHE[key]
        if time.time() - timestamp < _CACHE_TTL:
            return value
        del _CACHE[key]
    return None


def _cache_set(key: str, value: Any) -> None:
    """Set item in cache."""
    _CACHE[key] = (time.time(), value)


class SalesforceContextService:
    """Resolves Salesforce opportunity context for a matter."""

    def __init__(self) -> None:
        self.client = SalesforceMcpClient()
        self._search_cache: dict[str, Any] = {}

    async def close(self) -> None:
        await self.client.close()

    async def find_opportunity(
        self,
        counterparty_name: Optional[str],
        matter_name: Optional[str],
        document_name: Optional[str],
        matter_id: Optional[int],
    ) -> Optional[SalesforceOpportunity]:
        if not self.client.enabled:
            return None

        query_candidates = [counterparty_name, matter_name, document_name]
        query = next((value for value in query_candidates if value and value.strip()), None)
        if not query:
            return None

        payload = await self.client.get_commercial_context(query, matter_id=matter_id)
        if not payload:
            return None

        parsed = self._parse_commercial_context(payload)
        if not parsed:
            logger.info("Salesforce commercial context missing required fields", matter_name=_normalize(matter_name))
        return parsed

    def _parse_commercial_context(self, payload: dict[str, object]) -> Optional[SalesforceOpportunity]:
        opportunity_id = _normalize(str(payload.get("opportunity_id") or ""))
        opportunity_name = _normalize(str(payload.get("opportunity_name") or ""))
        if not opportunity_id or not opportunity_name:
            return None

        deal_stage = payload.get("deal_stage") if isinstance(payload.get("deal_stage"), dict) else {}
        organization = payload.get("organization") if isinstance(payload.get("organization"), dict) else {}
        financial_metrics = payload.get("financial_metrics") if isinstance(payload.get("financial_metrics"), dict) else {}
        legal_and_security = (
            payload.get("legal_and_security") if isinstance(payload.get("legal_and_security"), dict) else {}
        )
        competitive_landscape = (
            payload.get("competitive_landscape") if isinstance(payload.get("competitive_landscape"), dict) else {}
        )
        contract_dates = payload.get("contract_dates") if isinstance(payload.get("contract_dates"), dict) else {}
        renewal_information = (
            payload.get("renewal_information") if isinstance(payload.get("renewal_information"), dict) else {}
        )
        next_steps = payload.get("next_steps") if isinstance(payload.get("next_steps"), dict) else {}
        customer_health = payload.get("customer_health") if isinstance(payload.get("customer_health"), dict) else {}

        # Extract metadata for probability
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}

        return SalesforceOpportunity(
            opportunity_id=opportunity_id,
            opportunity_name=opportunity_name,
            stage_name=_normalize(str(deal_stage.get("stage_name") or "")) or None,
            close_date=_normalize(str(deal_stage.get("close_date") or "")) or None,
            region=_normalize(str(organization.get("region") or "")) or None,
            business_unit=_normalize(str(organization.get("business_unit") or "")) or None,
            acv=_parse_float(str(financial_metrics.get("acv") or "")),
            arr=_parse_float(str(financial_metrics.get("arr") or "")),
            discount=_parse_float(str(financial_metrics.get("discount") or "")),
            total_discount=_parse_float(str(financial_metrics.get("total_discount") or "")),
            payment_terms=_normalize(str(financial_metrics.get("payment_terms") or "")) or None,
            legal_required=_parse_bool(str(legal_and_security.get("legal_required") or "")),
            security_review_required=_parse_bool(str(legal_and_security.get("security_review_required") or "")),
            non_standard_terms_requested=_parse_bool(
                str(legal_and_security.get("non_standard_terms_requested") or "")
            ),
            redline_count=_parse_int(str(legal_and_security.get("redline_count") or "")),
            main_competitors=_normalize(str(competitive_landscape.get("main_competitors") or "")) or None,
            procurement_pressure=_normalize(str(competitive_landscape.get("procurement_pressure") or "")) or None,
            procurement_category=_normalize(str(competitive_landscape.get("procurement_category") or "")) or None,
            contract_start_date=_normalize(str(contract_dates.get("contract_start_date") or "")) or None,
            contract_end_date=_normalize(str(contract_dates.get("contract_end_date") or "")) or None,
            renewal_date=_normalize(str(renewal_information.get("renewal_date") or "")) or None,
            renewal_notice_period=_normalize(str(renewal_information.get("renewal_notice_period") or "")) or None,
            auto_renewal=_parse_bool(str(renewal_information.get("auto_renewal") or "")),
            next_step=_normalize(str(next_steps.get("next_step") or "")) or None,
            open_cases_count=_parse_int(str(customer_health.get("open_cases_count") or "")),
            max_open_case_severity=_normalize(str(customer_health.get("max_open_case_severity") or "")) or None,
            sla_breach=_parse_bool(str(customer_health.get("sla_breach") or "")),
            customer_health=_normalize(str(customer_health.get("customer_health") or "")) or None,
            # Deal status fields
            is_closed=_parse_bool(str(deal_stage.get("is_closed") or "")),
            is_won=_parse_bool(str(deal_stage.get("is_won") or "")),
            forecast_category=_normalize(str(deal_stage.get("forecast_category") or "")) or None,
            probability=_parse_float(str(metadata.get("probability") or "")),
            expected_revenue=_parse_float(str(financial_metrics.get("expected_revenue") or "")),
            opportunity_type=_normalize(str(competitive_landscape.get("opportunity_type") or "")) or None,
            lead_source=_normalize(str(competitive_landscape.get("lead_source") or "")) or None,
        )

    async def get_signing_likelihood(
        self,
        counterparty_name: Optional[str],
        matter_name: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Get signing likelihood assessment for an opportunity."""
        if not self.client.enabled:
            return None

        query_candidates = [counterparty_name, matter_name]
        query = next((value for value in query_candidates if value and value.strip()), None)
        if not query:
            return None

        payload = await self.client.get_signing_likelihood(query)
        return payload

    async def dynamic_search(
        self,
        filters: dict[str, Any],
        current_opportunity_name: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Dynamic search for opportunities based on flexible filters.
        
        Optimized with caching and parallel requests for speed.
        """
        if not self.client.enabled:
            return []

        # Reduced, deduplicated list - only unique company names needed
        # The API will match partial names, so "ACME" catches all ACME variants
        known_companies = [
            "ACME",
            "Burlington Textiles",
            "Dickenson",
            "Edge Communications",
            "Express Logistics",
            "GenePoint",
            "Grand Hotels",
            "United Oil",
            "Helios Energy",
        ]

        # Check cache first
        cache_key = f"search:{hash(frozenset(filters.items()))}:{current_opportunity_name}"
        cached = _cache_get(cache_key)
        if cached is not None:
            logger.debug("Using cached search results")
            return cached

        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()  # Deduplicate by opportunity ID

        async def fetch_company(company: str) -> Optional[dict[str, Any]]:
            """Fetch a single company with caching."""
            company_cache_key = f"company:{company}"
            cached_payload = _cache_get(company_cache_key)
            if cached_payload is not None:
                return cached_payload
            try:
                payload = await self.client.get_commercial_context(company)
                if payload:
                    _cache_set(company_cache_key, payload)
                return payload
            except Exception as e:
                logger.debug(f"Failed to query {company}: {e}")
                return None

        # Fetch all companies in parallel (much faster!)
        payloads = await asyncio.gather(*[fetch_company(c) for c in known_companies])

        for payload in payloads:
            if not payload:
                continue

            opp_id = payload.get("opportunity_id", "")
            opp_name = payload.get("opportunity_name", "")

            # Skip duplicates and current opportunity
            if opp_id in seen_ids:
                continue
            if current_opportunity_name and opp_name == current_opportunity_name:
                continue

            # Apply filters
            if not self._matches_filters(payload, filters):
                continue

            seen_ids.add(opp_id)
            results.append({
                "opportunity_name": opp_name,
                "opportunity_id": opp_id,
                "stage": payload.get("deal_stage", {}).get("stage_name"),
                "close_date": payload.get("deal_stage", {}).get("close_date"),
                "is_won": payload.get("deal_stage", {}).get("is_won"),
                "is_closed": payload.get("deal_stage", {}).get("is_closed"),
                "probability": payload.get("metadata", {}).get("probability"),
                "forecast_category": payload.get("deal_stage", {}).get("forecast_category"),
                "customer_health": payload.get("customer_health", {}).get("customer_health"),
                "region": payload.get("organization", {}).get("region"),
                "business_unit": payload.get("organization", {}).get("business_unit"),
                "acv": payload.get("financial_metrics", {}).get("acv"),
                "arr": payload.get("financial_metrics", {}).get("arr"),
                "account": payload.get("account", {}),
                "contracts": payload.get("contracts", []),
                "open_cases_count": payload.get("customer_health", {}).get("open_cases_count"),
            })

        _cache_set(cache_key, results)
        return results

    def _matches_filters(self, payload: dict[str, Any], filters: dict[str, Any]) -> bool:
        """Check if an opportunity matches the given filters."""
        if not filters:
            return True

        deal_stage = payload.get("deal_stage", {})
        org = payload.get("organization", {})
        health = payload.get("customer_health", {})
        metadata = payload.get("metadata", {})

        # Stage filter
        if "stage" in filters:
            opp_stage = (deal_stage.get("stage_name") or "").lower()
            filter_stage = filters["stage"].lower()
            if filter_stage not in opp_stage and opp_stage not in filter_stage:
                return False

        # Region filter
        if "region" in filters:
            opp_region = (org.get("region") or "").lower()
            filter_region = filters["region"].lower()
            if filter_region not in opp_region:
                return False

        # Health filter
        if "health" in filters:
            opp_health = (health.get("customer_health") or "").lower()
            filter_health = filters["health"].lower()
            if filter_health not in opp_health:
                return False

        # Probability filter
        if "min_probability" in filters:
            opp_prob = metadata.get("probability") or 0
            if opp_prob < filters["min_probability"]:
                return False

        # Is closed filter
        if "is_closed" in filters:
            if deal_stage.get("is_closed") != filters["is_closed"]:
                return False

        # Is won filter
        if "is_won" in filters:
            if deal_stage.get("is_won") != filters["is_won"]:
                return False

        return True
