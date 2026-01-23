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
    name: str
    account_name: str
    stage_name: str
    close_date: Optional[str]
    region: Optional[str]
    business_unit: Optional[str]
    legal_required: Optional[bool]
    security_review_required: Optional[bool]
    acv: Optional[float]
    arr: Optional[float]
    discount: Optional[float]
    total_discount: Optional[float]
    payment_terms: Optional[str]
    main_competitors: Optional[str]
    procurement_pressure: Optional[str]
    contract_start_date: Optional[str]
    contract_end_date: Optional[str]
    renewal_date: Optional[str]
    renewal_notice_period: Optional[int]
    auto_renewal: Optional[bool]
    next_step: Optional[str]
    non_standard_terms_requested: Optional[bool]
    redline_count: Optional[int]
    procurement_category: Optional[str]
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


def _normalize(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9]+", " ", text.lower())
    return [token for token in cleaned.split() if token]


def _extract_account_name(opportunity_name: str) -> str:
    for separator in (" – ", " - ", " — "):
        if separator in opportunity_name:
            return opportunity_name.split(separator, 1)[0].strip()
    return opportunity_name.strip()


def _score_match(matter_tokens: list[str], opportunity_name: str) -> int:
    if not matter_tokens:
        return 0
    tokens = _normalize(opportunity_name)
    return len(set(matter_tokens).intersection(tokens))


class SalesforceContextService:
    """Resolves Salesforce opportunity context for a matter."""

    def __init__(self) -> None:
        self.client = SalesforceMcpClient()

    async def close(self) -> None:
        await self.client.close()

    async def find_opportunity(self, matter_name: str) -> Optional[SalesforceOpportunity]:
        if not matter_name:
            return None

        opportunities: list[SalesforceOpportunity] = []
        if self.client.enabled:
            raw_records = await self.client.search_opportunities(matter_name)
            for record in raw_records:
                parsed = self._parse_record(record)
                if parsed:
                    opportunities.append(parsed)

        if not opportunities:
            return None

        matter_tokens = _normalize(matter_name)
        best = max(opportunities, key=lambda opp: _score_match(matter_tokens, opp.name))
        return best

    def _parse_record(self, record: dict[str, object]) -> Optional[SalesforceOpportunity]:
        name = str(record.get("Name") or "").strip()
        if not name:
            return None

        account_name = _extract_account_name(name)
        return SalesforceOpportunity(
            name=name,
            account_name=account_name,
            stage_name=str(record.get("StageName") or "").strip(),
            close_date=str(record.get("CloseDate") or "").strip() or None,
            region=str(record.get("Region__c") or "").strip() or None,
            business_unit=str(record.get("Business_Unit__c") or "").strip() or None,
            legal_required=_parse_bool(str(record.get("Legal_Required__c") or "")),
            security_review_required=_parse_bool(str(record.get("Security_Review_Required__c") or "")),
            acv=_parse_float(str(record.get("ACV__c") or "")),
            arr=_parse_float(str(record.get("ARR__c") or "")),
            discount=_parse_float(str(record.get("Discount__c") or "")),
            total_discount=_parse_float(str(record.get("Total_Discount__c") or "")),
            payment_terms=str(record.get("Payment_Terms__c") or "").strip() or None,
            main_competitors=str(record.get("MainCompetitors__c") or "").strip() or None,
            procurement_pressure=str(record.get("Procurement_Pressure__c") or "").strip() or None,
            contract_start_date=str(record.get("Contract_Start_Date__c") or "").strip() or None,
            contract_end_date=str(record.get("Contract_End_Date__c") or "").strip() or None,
            renewal_date=str(record.get("Renewal_Date__c") or "").strip() or None,
            renewal_notice_period=_parse_int(str(record.get("Renewal_Notice_Period__c") or "")),
            auto_renewal=_parse_bool(str(record.get("AutoRenewal__c") or "")),
            next_step=str(record.get("NextStep__c") or "").strip() or None,
            non_standard_terms_requested=_parse_bool(str(record.get("Non_Standard_Terms_Requested__c") or "")),
            redline_count=_parse_int(str(record.get("Redline_Count__c") or "")),
            procurement_category=str(record.get("Procurement_Category__c") or "").strip() or None,
            open_cases_count=_parse_int(str(record.get("Open_Cases_Count__c") or "")),
            max_open_case_severity=str(record.get("Max_Open_Case_Severity__c") or "").strip() or None,
            sla_breach=_parse_bool(str(record.get("SLA_Breach__c") or "")),
            customer_health=str(record.get("Customer_Health__c") or "").strip() or None,
        )
