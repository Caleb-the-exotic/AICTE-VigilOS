# ============================================================
# campus/agents/overlap_agent.py — Cross-Bureau Overlap Detection Agent
# ============================================================
# PS26264: Detects when the same institution has concurrent active
# cases in BOTH the Regulation Bureau (RB) and PGRC, raising a
# coordinated-action alert with explainable AI rationale.
# ============================================================

import json
import re
from typing import Optional


OVERLAP_SYSTEM_PROMPT = """You are the OVERLAP DETECTION AGENT of VigilOS.

Your job is to analyze two complaint case descriptions and determine if they:
1. Target the same root issue (even if titled differently)
2. Are likely to create conflicting or duplicated regulatory actions

You MUST call the analyze_case_overlap function with your analysis.

RULES:
- Score 0.0–1.0 (1.0 = definite overlap requiring immediate coordination)
- Scores ≥ 0.70 → flag as overlap requiring joint committee review
- Scores 0.40–0.69 → flag as possible overlap, recommend monitoring
- Scores < 0.40 → likely independent, no overlap
- Common overlaps: salary non-payment (PGRC) + faculty cadre ratio (RB), 
  capitation fee complaints (PGRC) + fee regulation violation (RB),
  infrastructure complaints (PGRC) + physical infrastructure norms (RB)

Always return a clear, human-readable reason for AICTE officers to act on."""

OVERLAP_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_case_overlap",
            "description": "Analyze whether two complaint cases overlap in substance and require cross-bureau coordination.",
            "parameters": {
                "type": "object",
                "properties": {
                    "overlap_score": {
                        "type": "number",
                        "description": "Confidence score 0.0 to 1.0 indicating degree of substantive overlap."
                    },
                    "overlap_type": {
                        "type": "string",
                        "enum": ["definite_overlap", "possible_overlap", "independent"],
                        "description": "Classification of the overlap severity."
                    },
                    "shared_root_cause": {
                        "type": "string",
                        "description": "The common root issue connecting both cases (e.g., 'Non-compliance with faculty appointment norms')."
                    },
                    "recommended_action": {
                        "type": "string",
                        "description": "Recommended AICTE action (e.g., 'Initiate Joint RB+PGRC Hearing', 'Consolidate under RB case ID', 'Monitor independently')."
                    },
                    "reason": {
                        "type": "string",
                        "description": "Detailed human-readable explanation for AICTE officers explaining why these cases overlap."
                    }
                },
                "required": ["overlap_score", "overlap_type", "shared_root_cause", "recommended_action", "reason"]
            }
        }
    }
]


class OverlapAgent:
    """
    AI-powered cross-bureau overlap detection agent.
    Analyzes complaint descriptions semantically to identify when
    RB and PGRC are taking parallel action on the same institution issue.
    """

    def __init__(self, client=None, model: str = "openai/gpt-oss-120b"):
        self.client = client
        self.model = model

    def analyze_overlap(self, case_a: dict, case_b: dict) -> dict:
        """
        Compare two cases from different bureaus for semantic overlap.
        Returns structured overlap analysis with confidence score.
        """
        if self.client:
            try:
                return self._llm_analyze(case_a, case_b)
            except Exception as e:
                pass

        # Fallback: rule-based keyword overlap detection
        return self._rule_based_analyze(case_a, case_b)

    def _llm_analyze(self, case_a: dict, case_b: dict) -> dict:
        """Use Groq LLM for semantic overlap analysis."""
        prompt = f"""
Case 1 (Bureau: {case_a.get('bureau', 'RB')}):
  Category: {case_a.get('category', 'unknown')}
  Title: {case_a.get('title', '')}
  Description: {case_a.get('description', '')}
  Status: {case_a.get('status', '')}

Case 2 (Bureau: {case_b.get('bureau', 'PGRC')}):
  Category: {case_b.get('category', 'unknown')}
  Title: {case_b.get('title', '')}
  Description: {case_b.get('description', '')}
  Status: {case_b.get('status', '')}

Analyze whether these two cases from DIFFERENT bureaus are targeting the same underlying institutional compliance issue.
Call analyze_case_overlap with your findings."""

        messages = [
            {"role": "system", "content": OVERLAP_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=OVERLAP_TOOLS,
            tool_choice={"type": "function", "function": {"name": "analyze_case_overlap"}},
            temperature=0.1,
            max_tokens=800,
        )

        msg = response.choices[0].message
        if msg.tool_calls:
            result = json.loads(msg.tool_calls[0].function.arguments)
            result["method"] = "llm"
            return result

        raise ValueError("LLM did not call the tool")

    def _rule_based_analyze(self, case_a: dict, case_b: dict) -> dict:
        """Fast keyword-based fallback overlap detector."""
        # Known overlap patterns
        OVERLAP_PATTERNS = [
            {
                "rb_keywords": ["faculty cadre", "faculty ratio", "appointment", "faculty strength"],
                "pgrc_keywords": ["salary", "non-payment", "emoluments", "wages", "stipend"],
                "root_cause": "Faculty appointment and remuneration non-compliance",
                "action": "Initiate Joint RB+PGRC Hearing on Faculty Management",
                "score": 0.88
            },
            {
                "rb_keywords": ["fee regulation", "fee structure", "excess fee", "capitation"],
                "pgrc_keywords": ["capitation fee", "excess charges", "refund", "fee demand"],
                "root_cause": "Unauthorized fee collection violating AICTE fee norms",
                "action": "Consolidate under RB with PGRC observer status",
                "score": 0.92
            },
            {
                "rb_keywords": ["infrastructure norms", "physical infrastructure", "lab norms", "building"],
                "pgrc_keywords": ["infrastructure", "facility", "lab equipment", "unsafe", "building condition"],
                "root_cause": "Physical infrastructure deficiency affecting students",
                "action": "Joint inspection recommended — RB + PGRC site visit",
                "score": 0.75
            },
            {
                "rb_keywords": ["intake", "admission", "sanctioned strength", "lateral entry"],
                "pgrc_keywords": ["admission", "seats", "over-admission", "merit", "donation"],
                "root_cause": "Irregular admission practices exceeding sanctioned intake",
                "action": "Transfer PGRC case to RB — regulatory jurisdiction",
                "score": 0.82
            },
        ]

        desc_a = (case_a.get("description", "") + " " + case_a.get("title", "") + " " + case_a.get("category", "")).lower()
        desc_b = (case_b.get("description", "") + " " + case_b.get("title", "") + " " + case_b.get("category", "")).lower()

        bureaus = {case_a.get("bureau", ""), case_b.get("bureau", "")}
        same_pid = bool(case_a.get("aicte_pid") and case_a.get("aicte_pid") == case_b.get("aicte_pid"))

        rb_desc = desc_a if case_a.get("bureau") == "RB" else desc_b
        pgrc_desc = desc_b if case_b.get("bureau") == "PGRC" else desc_a

        best_score = 0.0
        best_pattern = None

        for pattern in OVERLAP_PATTERNS:
            rb_match = any(k in rb_desc for k in pattern["rb_keywords"])
            pgrc_match = any(k in pgrc_desc for k in pattern["pgrc_keywords"])
            # Also check reversed (keywords might appear in either)
            rb_match_rev = any(k in pgrc_desc for k in pattern["rb_keywords"])
            pgrc_match_rev = any(k in rb_desc for k in pattern["pgrc_keywords"])

            if (rb_match and pgrc_match) or (rb_match_rev and pgrc_match_rev):
                if pattern["score"] > best_score:
                    best_score = pattern["score"]
                    best_pattern = pattern

        if best_pattern:
            return {
                "overlap_score": best_score,
                "overlap_type": "definite_overlap" if best_score >= 0.7 else "possible_overlap",
                "shared_root_cause": best_pattern["root_cause"],
                "recommended_action": best_pattern["action"],
                "reason": (
                    f"Case {case_a.get('case_id')} addresses '{case_a.get('category', 'compliance issue')}' "
                    f"while Case {case_b.get('case_id')} addresses '{case_b.get('category', 'grievance')}'. "
                    f"Both trace to: {best_pattern['root_cause']}. "
                    f"Without coordination, parallel proceedings risk conflicting regulatory orders."
                ),
                "method": "rule_based"
            }

        # Same institution & same category overlap check (same bureau or cross bureau)
        if same_pid and case_a.get("category") and case_a.get("category") == case_b.get("category"):
            return {
                "overlap_score": 0.85,
                "overlap_type": "definite_overlap",
                "shared_root_cause": f"Concurrent complaints under {case_a.get('category')} for same institution",
                "recommended_action": "Consolidate proceedings under joint case track to prevent conflicting resolutions",
                "reason": (
                    f"Both cases share the category '{case_a.get('category')}' for institution {case_a.get('institution_name', case_a.get('aicte_pid'))}. "
                    f"Consolidation is advised to streamline regulatory investigation."
                ),
                "method": "rule_based"
            }

        return {
            "overlap_score": 0.15,
            "overlap_type": "independent",
            "shared_root_cause": "No significant shared root cause identified",
            "recommended_action": "Process independently per standard bureau procedures",
            "reason": "Cases appear to address distinct institutional issues without substantive overlap.",
            "method": "rule_based"
        }

    def batch_scan_institution(self, cases: list[dict]) -> list[dict]:
        """
        Scan all cases for an institution and find all overlapping pairs.
        Returns list of overlap alerts with case pair references.
        """
        alerts = []
        rb_cases = [c for c in cases if c.get("bureau") == "RB" and c.get("status") not in ("disposed",)]
        pgrc_cases = [c for c in cases if c.get("bureau") == "PGRC" and c.get("status") not in ("disposed",)]

        for rb_case in rb_cases:
            for pgrc_case in pgrc_cases:
                analysis = self.analyze_overlap(rb_case, pgrc_case)
                if analysis.get("overlap_score", 0) >= 0.40:
                    alerts.append({
                        "rb_case_id": rb_case.get("case_id"),
                        "pgrc_case_id": pgrc_case.get("case_id"),
                        "aicte_pid": rb_case.get("aicte_pid"),
                        "institution_name": rb_case.get("institution_name"),
                        **analysis
                    })

        # Sort by score descending
        alerts.sort(key=lambda x: x.get("overlap_score", 0), reverse=True)
        return alerts
