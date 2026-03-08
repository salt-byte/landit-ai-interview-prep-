"""
Layer 4: Pure Python backend computation — no LLM, fully deterministic.
Handles: Ability Aggregation, Gap Matrix, Match Score.
"""
from config import DIMENSIONS, DIMENSION_LABELS


def normalize_weights(dimension_data: dict) -> dict:
    """Normalize dimension weights so Σ(weights) = 1.0"""
    total = sum(v.get("weight", 0) for v in dimension_data.values())
    if total == 0:
        equal_weight = 1.0 / len(DIMENSIONS)
        return {k: {**v, "weight": equal_weight} for k, v in dimension_data.items()}
    return {k: {**v, "weight": v.get("weight", 0) / total} for k, v in dimension_data.items()}


def compute_match_score(
    user_scores: dict[str, float],
    role_model: dict,
) -> tuple[float, list[dict]]:
    """
    Compute weighted match score and gap matrix.

    Args:
        user_scores: {dim_key: score (1-5)}
        role_model: {dim_key: {required_score, weight}}

    Returns:
        (match_score_pct, gap_details)
        match_score = Σ(weight × min(user/required, 1)) × 100
    """
    role_model = normalize_weights(role_model)
    gaps = []
    match_score = 0.0

    for dim in DIMENSIONS:
        user_score = user_scores.get(dim, 0.0)
        role_data = role_model.get(dim, {"required_score": 3.0, "weight": 1.0 / len(DIMENSIONS)})
        required = role_data.get("required_score", 3.0)
        weight = role_data.get("weight", 0.0)

        ratio = min(user_score / required, 1.0) if required > 0 else 1.0
        match_score += weight * ratio

        gaps.append({
            "dimension": dim,
            "label": DIMENSION_LABELS.get(dim, dim),
            "user_score": round(user_score, 2),
            "required_score": round(required, 2),
            "weight": round(weight, 4),
            "gap": round(required - user_score, 2),
        })

    # Sort by gap descending (biggest deficits first)
    gaps.sort(key=lambda x: x["gap"], reverse=True)
    return round(match_score * 100, 1), gaps


def aggregate_user_scores(
    session_scores_list: list[dict[str, float]],
    strategy: str = "weighted_avg",
) -> dict[str, float]:
    """
    Aggregate dimension scores across multiple sessions.

    Strategies:
    - weighted_avg: Σ(score × weight) / Σ(weight), recent sessions weighted higher
    - time_decay: exponential decay, recent sessions matter more
    - max_ever: take the best score seen per dimension
    """
    if not session_scores_list:
        return {dim: 0.0 for dim in DIMENSIONS}

    n = len(session_scores_list)
    aggregated = {}

    for dim in DIMENSIONS:
        scores = [s.get(dim, 0.0) for s in session_scores_list]
        scores = [s for s in scores if s > 0]  # ignore zeros (no evidence)

        if not scores:
            aggregated[dim] = 0.0
            continue

        if strategy == "max_ever":
            aggregated[dim] = max(scores)
        elif strategy == "time_decay":
            # Exponential decay: more recent = higher weight
            weights = [0.5 ** (len(scores) - i - 1) for i in range(len(scores))]
            total_w = sum(weights)
            aggregated[dim] = sum(s * w for s, w in zip(scores, weights)) / total_w
        else:  # weighted_avg with recency bias
            # Linear recency: sessions weighted 1, 2, 3, ..., n
            weights = list(range(1, len(scores) + 1))
            total_w = sum(weights)
            aggregated[dim] = sum(s * w for s, w in zip(scores, weights)) / total_w

        aggregated[dim] = round(aggregated[dim], 2)

    return aggregated


def compute_weakness_vector(
    user_scores: dict[str, float],
    role_model: dict | None = None,
) -> dict[str, float]:
    """
    Compute weakness vector: normalized weakness weights per dimension.
    Higher value = weaker relative to requirements.

    Returns dict: {dim_key: weakness_weight (0-1)}
    """
    weaknesses = {}

    for dim in DIMENSIONS:
        score = user_scores.get(dim, 0.0)
        if role_model and dim in role_model:
            required = role_model[dim].get("required_score", 3.0)
            gap = max(required - score, 0)
            # Normalize gap to 0-1 range (max gap = 4, from score=1, required=5)
            weaknesses[dim] = round(min(gap / 4.0, 1.0), 3)
        else:
            # Without role context: invert score (5=strong → 0 weakness, 1=weak → 1 weakness)
            weaknesses[dim] = round(max(0, (5 - score) / 4.0), 3)

    return weaknesses


def build_gap_summary(gaps: list[dict], top_n: int = 5) -> str:
    """Build a human-readable gap summary for LLM prompts."""
    significant = [g for g in gaps if g["gap"] > 0.5][:top_n]
    if not significant:
        return "No significant gaps identified. Strong match for the role."

    lines = ["Key skill gaps (dimension: user score → required score):"]
    for g in significant:
        lines.append(f"- {g['label']}: {g['user_score']:.1f} → {g['required_score']:.1f} (gap: {g['gap']:.1f})")
    return "\n".join(lines)


def build_profile_summary(profile_data: dict) -> str:
    """Build a concise text summary of user profile for LLM prompts."""
    parts = []
    if profile_data.get("name"):
        parts.append(f"Name: {profile_data['name']}")
    if profile_data.get("headline"):
        parts.append(f"Title: {profile_data['headline']}")
    if profile_data.get("years_of_experience"):
        parts.append(f"Experience: {profile_data['years_of_experience']}")

    exp = profile_data.get("experience", [])
    if exp:
        parts.append("Experience:")
        for e in exp[:3]:
            parts.append(f"  - {e.get('role', '')} at {e.get('company', '')} ({e.get('duration', '')})")
            if e.get("responsibilities"):
                parts.append(f"    {e['responsibilities'][:200]}")

    edu = profile_data.get("education", [])
    if edu:
        e = edu[0]
        parts.append(f"Education: {e.get('degree', '')} in {e.get('major', '')} from {e.get('school', '')}")

    skills = profile_data.get("skills", {})
    if skills.get("technical"):
        parts.append(f"Technical skills: {skills['technical']}")
    if skills.get("product"):
        parts.append(f"Product skills: {skills['product']}")

    return "\n".join(parts)
