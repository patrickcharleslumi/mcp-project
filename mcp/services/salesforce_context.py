"""Salesforce context service for AI insights."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from mcp.clients.salesforce_mcp import SalesforceMcpClient
from mcp.config import config
from mcp.logging import get_logger

logger = get_logger(__name__)


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


class SalesforceContextService:
    """Resolves Salesforce opportunity context for a matter."""

    def __init__(self) -> None:
        self.client = SalesforceMcpClient()

    async def close(self) -> None:
        await self.client.close()

    async def find_opportunity(self, matter_name: str) -> Optional[SalesforceOpportunity]:
        if not matter_name:
            return None

        if not self.client.enabled:
            return None

        payload = await self.client.get_commercial_context(matter_name)
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
        )
