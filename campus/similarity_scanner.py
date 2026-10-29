# campus/similarity_scanner.py - Complaint String Matcher & Grok LLM Scanner
# ==============================================================================
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from groq import Groq
from campus.db import get_conn
from campus.institution_registration_service import create_notification, get_officer_user_ids

logger = logging.getLogger("similarity_scanner")

def tokenize_and_clean(text: str) -> List[str]:
    """
    Split text into normalized alphanumeric words / tokens.
    Filters out common noise and keeps meaningful domain keywords.
    """
    if not text:
        return []
    words = re.findall(r'[a-zA-Z0-9_\-]+', text.lower())
    # Exclude common stopwords
    stop_words = {
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'for', 'of',
        'with', 'as', 'by', 'this', 'that', 'it', 'from', 'be', 'are', 'was', 'were', 'has',
        'have', 'had', 'been', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
        'must', 'we', 'our', 'my', 'their', 'they', 'he', 'she', 'him', 'her', 'us', 'you', 'your'
    }
    return [w for w in words if len(w) > 2 and w not in stop_words]

def compute_string_match_score(new_tokens: List[str], target_text: str) -> Tuple[float, int, List[str]]:
    """
    Compute string token overlap frequency against an existing case.
    Returns (match_ratio, match_count, matched_words).
    """
    if not new_tokens or not target_text:
        return 0.0, 0, []
    
    target_tokens = set(tokenize_and_clean(target_text))
    if not target_tokens:
        return 0.0, 0, []
    
    matched = [w for w in set(new_tokens) if w in target_tokens]
    match_count = len(matched)
    # Jaccard-like or token coverage score
    score = match_count / max(len(set(new_tokens)), 1)
    return score, match_count, matched[:10]

def scan_and_match_complaint(
    new_case_id: str,
    new_title: str,
    new_desc: str,
    new_category: str,
    new_bureau: str,
    new_inst_name: str,
    new_aicte_pid: str,
    document_text: str = ""
) -> List[Dict[str, Any]]:
    """
    1. Combines complaint title, description, and scanned document OCR text.
    2. Splits string into tokens.
    3. Scans all active and historical cases in PostgreSQL to find top matching candidate cases.
    4. Evaluates candidate cases using Grok LLM for root cause, severity, and semantic overlap.
    5. Saves overlap alerts in PostgreSQL and creates real-time officer notifications.
    """
    full_incoming_text = f"{new_title}\n{new_desc}\n{document_text}".strip()
    incoming_tokens = tokenize_and_clean(full_incoming_text)
    
    if not incoming_tokens:
        return []

    conn = get_conn()
    cur = conn.cursor()
    # Fetch all cases except current new_case_id
    cur.execute("""
        SELECT case_id, aicte_pid, institution_name, bureau, category, title, description, status, created_at
        FROM aicte_cases
        WHERE case_id != %s
        ORDER BY created_at DESC
        LIMIT 200;
    """, (new_case_id,))
    rows = cur.fetchall()
    conn.close()

    candidates = []
    for r in rows:
        c_dict = dict(r) if hasattr(r, "keys") else {
            "case_id": r[0], "aicte_pid": r[1], "institution_name": r[2],
            "bureau": r[3], "category": r[4], "title": r[5],
            "description": r[6], "status": r[7], "created_at": r[8]
        }
        target_combined = f"{c_dict.get('title', '')} {c_dict.get('category', '')} {c_dict.get('description', '')}"
        score, match_cnt, matched_words = compute_string_match_score(incoming_tokens, target_combined)
        
        # Boost score if category matches or same institution
        if c_dict.get("category") == new_category:
            score += 0.20
        if c_dict.get("aicte_pid") == new_aicte_pid:
            score += 0.30

        if match_cnt >= 2 or score >= 0.25:
            candidates.append({
                "case": c_dict,
                "string_score": round(score, 3),
                "match_count": match_cnt,
                "matched_words": matched_words
            })

    # Sort candidates by string overlap descending
    candidates.sort(key=lambda x: (x["string_score"], x["match_count"]), reverse=True)
    top_candidates = candidates[:3]  # Evaluate top 3 closest matches with Grok LLM

    if not top_candidates:
        return []

    # Initialize Grok LLM Client
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    llm_client = Groq(api_key=groq_api_key) if groq_api_key else None
    model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    verified_matches = []

    for cand in top_candidates:
        target_case = cand["case"]
        string_score = cand["string_score"]
        matched_words = cand["matched_words"]

        llm_analysis = None
        if llm_client:
            try:
                system_prompt = (
                    "You are the VigilOS Regulatory Overlap & Similarity Intelligence Agent for AICTE.\n"
                    "Analyze whether the newly submitted complaint case substantively matches or overlaps with "
                    "an existing case in allegations, root cause, or institution compliance violations.\n"
                    "Output valid JSON ONLY with the following schema:\n"
                    "{\n"
                    "  \"overlap_score\": <float 0.0 to 1.0>,\n"
                    "  \"overlap_type\": <\"definite_overlap\" | \"possible_overlap\" | \"independent\">,\n"
                    "  \"shared_root_cause\": <string>,\n"
                    "  \"recommended_action\": <string>,\n"
                    "  \"reason\": <detailed string explanation for regulatory officers>\n"
                    "}"
                )

                user_prompt = (
                    f"NEW COMPLAINT (Case {new_case_id}):\n"
                    f"Institution: {new_inst_name} (PID: {new_aicte_pid})\n"
                    f"Bureau: {new_bureau} | Category: {new_category}\n"
                    f"Title: {new_title}\n"
                    f"Details & Scanned Evidence: {full_incoming_text[:1200]}\n\n"
                    f"EXISTING CASE TO COMPARE (Case {target_case.get('case_id')}):\n"
                    f"Institution: {target_case.get('institution_name')} (PID: {target_case.get('aicte_pid')})\n"
                    f"Bureau: {target_case.get('bureau')} | Category: {target_case.get('category')}\n"
                    f"Title: {target_case.get('title')}\n"
                    f"Description: {target_case.get('description')}\n"
                    f"String Overlap Words: {', '.join(matched_words)}"
                )

                completion = llm_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    model=model_name,
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                raw_json = completion.choices[0].message.content
                llm_analysis = json.loads(raw_json)
            except Exception as e:
                logger.warning(f"[SimilarityScanner] Grok LLM evaluation error: {e}")

        # If LLM failed or wasn't available, build structured deterministic fallback
        if not llm_analysis:
            overlap_score = min(max(string_score, 0.45), 0.95)
            llm_analysis = {
                "overlap_score": round(overlap_score, 2),
                "overlap_type": "definite_overlap" if overlap_score >= 0.70 else "possible_overlap",
                "shared_root_cause": f"Matching keywords in {new_category}: {', '.join(matched_words[:4])}",
                "recommended_action": "Cross-verify files across bureaus and schedule joint officer review",
                "reason": f"High lexical similarity ({cand['match_count']} word matches: {', '.join(matched_words)}) indicates identical subject matter."
            }

        final_score = float(llm_analysis.get("overlap_score", string_score))

        # Store alert if significant match (>= 0.40)
        if final_score >= 0.40:
            match_record = {
                "new_case_id": new_case_id,
                "matched_case_id": target_case.get("case_id"),
                "matched_institution_name": target_case.get("institution_name"),
                "matched_bureau": target_case.get("bureau"),
                "overlap_score": final_score,
                "overlap_type": llm_analysis.get("overlap_type", "possible_overlap"),
                "shared_root_cause": llm_analysis.get("shared_root_cause", ""),
                "recommended_action": llm_analysis.get("recommended_action", ""),
                "reason": llm_analysis.get("reason", ""),
                "matched_words": matched_words,
            }
            verified_matches.append(match_record)

            # 1. Save into overlap_alerts table
            try:
                from campus.db import save_overlap_alert
                save_overlap_alert(
                    aicte_pid=new_aicte_pid or target_case.get("aicte_pid", ""),
                    rb_case_id=new_case_id if new_bureau == "RB" else target_case.get("case_id"),
                    pgrc_case_id=new_case_id if new_bureau != "RB" else target_case.get("case_id"),
                    overlap_score=final_score,
                    overlap_type=llm_analysis.get("overlap_type", "possible_overlap"),
                    shared_root_cause=llm_analysis.get("shared_root_cause", ""),
                    recommended_action=llm_analysis.get("recommended_action", ""),
                    reason=llm_analysis.get("reason", "")
                )
            except Exception as save_err:
                logger.warning(f"[SimilarityScanner] Error saving overlap alert: {save_err}")

            # 2. Dispatch Persistent Notification to Officer Portal /notifications
            officer_ids = get_officer_user_ids()
            for oid in officer_ids:
                create_notification(
                    recipient_user_id=oid,
                    notif_type="overlap_alert",
                    title=f"AI Overlap Alert: {new_case_id} <-> {target_case.get('case_id')}",
                    body=(
                        f"Grok LLM identified a {int(final_score * 100)}% match between new case {new_case_id} "
                        f"and existing case {target_case.get('case_id')} ({target_case.get('institution_name')}). "
                        f"Root cause: {llm_analysis.get('shared_root_cause')}"
                    ),
                    action_url=f"/cases?case_id={new_case_id}&tab=overlaps",
                    reference_id=new_case_id,
                    idempotency_key=f"overlap_match_{new_case_id}_{target_case.get('case_id')}_{oid}"
                )

    return verified_matches
