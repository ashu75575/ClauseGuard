"""Deterministic negotiation playbook defaults by risk category."""

from __future__ import annotations

from typing import Dict

PLAYBOOK_DEFAULTS: Dict[str, Dict[str, str]] = {
    "auto_renewal": {
        "primary_ask": "Require affirmative written consent before any renewal.",
        "fallback": "Keep auto-renewal but require 60 days' prior written notice and an easy opt-out.",
        "rationale": "Silent renewals trap users into unexpected fees and term extensions.",
        "suggested_language": "This Agreement renews only upon the parties' prior written agreement, executed at least thirty (30) days before the then-current term ends.",
    },
    "liability": {
        "primary_ask": "Make liability mutual and exclude only indirect damages with a reasonable cap.",
        "fallback": "Accept a cap at 12 months of fees paid, excluding gross negligence and willful misconduct.",
        "rationale": "One-sided liability caps leave the weaker party unprotected for core breaches.",
        "suggested_language": "Each party's aggregate liability under this Agreement shall not exceed the fees paid or payable in the twelve (12) months preceding the claim, except for fraud, willful misconduct, or breach of confidentiality.",
    },
    "arbitration": {
        "primary_ask": "Preserve the right to bring claims in court of competent jurisdiction.",
        "fallback": "Agree to arbitration only if it is optional, local, and does not waive class or injunctive relief for public claims.",
        "rationale": "Mandatory arbitration can raise costs and limit remedies for individuals.",
        "suggested_language": "Either party may elect binding arbitration or pursue remedies in a court of competent jurisdiction. Nothing herein waives rights to seek provisional injunctive relief.",
    },
    "data_sharing": {
        "primary_ask": "Limit sharing to named subprocessors with prior notice and an opt-out.",
        "fallback": "Require contractual safeguards equivalent to the main agreement and prompt breach notice.",
        "rationale": "Broad sharing rights increase privacy and regulatory exposure.",
        "suggested_language": "Provider may share Customer Data only with pre-approved subprocessors bound by written confidentiality and data-protection obligations no less protective than this Agreement.",
    },
    "termination": {
        "primary_ask": "Require cause and cure periods for termination, with mutual exit rights.",
        "fallback": "Allow termination for convenience with 30 days' notice and pro-rata refund of prepaid unused fees.",
        "rationale": "Unilateral termination without notice creates operational and financial risk.",
        "suggested_language": "Either party may terminate for material breach if the breach remains uncured thirty (30) days after written notice. Fees prepaid for unused periods after termination without cause shall be refunded pro rata.",
    },
    "penalty": {
        "primary_ask": "Remove liquidated damages that are punitive or one-sided.",
        "fallback": "Cap penalties and require a reasonable pre-estimate of actual harm.",
        "rationale": "Punitive fees can be unenforceable and commercially unfair.",
        "suggested_language": "Any liquidated damages shall be a reasonable pre-estimate of anticipated harm and shall not exceed the actual fees attributable to the affected period.",
    },
    "indemnification": {
        "primary_ask": "Make indemnities mutual for IP infringement, data breach, and third-party claims arising from each party's negligence.",
        "fallback": "Accept vendor IP indemnity and limit customer indemnity to misuse and unlawful content.",
        "rationale": "One-way indemnities shift disproportionate legal cost.",
        "suggested_language": "Each party shall indemnify the other against third-party claims arising from its negligence, willful misconduct, or infringement of intellectual property caused by materials it provides.",
    },
    "intellectual_property": {
        "primary_ask": "Customer retains ownership of customer data and pre-existing IP; vendor gets only a limited license to perform the services.",
        "fallback": "Grant a non-exclusive license limited to the term and service purpose.",
        "rationale": "Overbroad IP assignment can permanently transfer customer assets.",
        "suggested_language": "Customer retains all right, title, and interest in Customer Data and Customer Materials. Provider receives a limited, non-exclusive license solely to provide the Services during the Term.",
    },
    "confidentiality": {
        "primary_ask": "Add mutual confidentiality with a defined term and standard exceptions.",
        "fallback": "Accept existing confidentiality if residuals and compelled-disclosure notices are fair.",
        "rationale": "Weak confidentiality terms expose sensitive business information.",
        "suggested_language": "Each party shall protect the other's Confidential Information with reasonable care for three (3) years after disclosure, or longer for trade secrets, and give prompt notice of any legally compelled disclosure.",
    },
    "non_compete": {
        "primary_ask": "Remove or narrowly tailor non-compete restrictions to protect legitimate interests only.",
        "fallback": "Limit duration, geography, and scope to the customer's competitive niche.",
        "rationale": "Broad non-competes can be unenforceable and restrict livelihood.",
        "suggested_language": "Any non-compete shall be limited to twelve (12) months, the geographic markets where the party actively competed, and roles substantially similar to those performed under this Agreement.",
    },
    "payment_terms": {
        "primary_ask": "Align invoices to acceptance milestones and allow dispute holds without late fees.",
        "fallback": "Net-30 with a short cure period before suspension.",
        "rationale": "Aggressive payment and suspension terms create cash-flow and service risk.",
        "suggested_language": "Invoices are due within thirty (30) days of receipt. Customer may withhold disputed amounts in good faith while the parties work in good faith to resolve the dispute.",
    },
    "force_majeure": {
        "primary_ask": "Exclude payment obligations that became due before the event and allow termination after prolonged delay.",
        "fallback": "Require prompt notice and mitigation efforts.",
        "rationale": "Overbroad force majeure can excuse core performance indefinitely.",
        "suggested_language": "A force majeure event excuses non-performance only while it prevents performance, requires prompt notice and mitigation, and either party may terminate if the delay exceeds sixty (60) consecutive days.",
    },
}


def playbook_for_category(category: str) -> Dict[str, str]:
    return PLAYBOOK_DEFAULTS.get(
        category,
        {
            "primary_ask": "Clarify the clause and add mutual protections before signing.",
            "fallback": "Add notice, cure, and proportional remedies.",
            "rationale": "Ambiguous or one-sided terms increase negotiation and enforcement risk.",
            "suggested_language": "The parties shall negotiate in good faith to clarify obligations, notice requirements, and proportionate remedies for this clause.",
        },
    )
