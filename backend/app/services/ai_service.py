from __future__ import annotations

import json

try:
    from openai import OpenAI
except ImportError:  # optional dependency at runtime when AI is disabled
    OpenAI = None

from app.core.config import settings


def _client() -> OpenAI | None:
    if not settings.ai_api_key or OpenAI is None:
        return None
    kwargs = {"api_key": settings.ai_api_key}
    if settings.ai_base_url:
        kwargs["base_url"] = settings.ai_base_url
    return OpenAI(**kwargs)


def _parse_json(content: str) -> dict | None:
    """Parse a JSON object, including JSON wrapped in markdown or extra text."""
    content = (content or "").strip()
    if not content:
        return None

    try:
        value = json.loads(content)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        pass

    # Handle ```json ... ``` and responses containing a JSON object after reasoning.
    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(content[start : end + 1])
            return value if isinstance(value, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _call_json(system: str, user: str) -> dict | None:
    client = _client()
    if not client:
        return None

    # GPT-OSS is a reasoning model. With Groq JSON mode, explicitly hiding
    # reasoning keeps reasoning tokens out of the JSON-constrained response.
    request = {
        "model": settings.ai_model,
        "temperature": 0.2,
        "reasoning_format": "hidden",
        "max_completion_tokens": 2500,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": system
                + "\nReturn ONLY one valid JSON object. Do not include markdown, commentary, or reasoning outside the JSON object.",
            },
            {"role": "user", "content": user},
        ],
    }

    try:
        response = client.chat.completions.create(**request)
        result = _parse_json(response.choices[0].message.content or "")
        if result is not None:
            return result
    except Exception:
        # Keep repository analysis usable if Groq rejects JSON mode or
        # temporarily returns a generation error. Retry as plain text and
        # parse the JSON object ourselves.
        pass

    try:
        fallback_request = {
            "model": settings.ai_model,
            "temperature": 0.2,
            "reasoning_format": "hidden",
            "max_completion_tokens": 2500,
            "messages": [
                {
                    "role": "system",
                    "content": system
                    + "\nReturn ONLY one valid JSON object. No markdown or commentary.",
                },
                {"role": "user", "content": user},
            ],
        }
        response = client.chat.completions.create(**fallback_request)
        return _parse_json(response.choices[0].message.content or "")
    except Exception:
        return None


def repository_insights(context: dict) -> dict:
    prompt = f"""
Analyze this software repository using the supplied structured evidence. Do not invent files or technologies.
Return JSON with keys: summary, strengths (array), priorities (array), architecture_explanation, engineering_questions (array of strings).
Evidence:
{json.dumps(context, ensure_ascii=False)[:50000]}
"""
    result = _call_json(
        "You are a senior software engineer reviewing a repository. Be concrete and evidence-based.",
        prompt,
    )
    if result:
        return result
    metrics = context.get("metrics", {})
    return {
        "summary": f"Repository contains {metrics.get('total_files', 0)} analyzed files across {len(metrics.get('languages', {}))} languages with about {metrics.get('code_lines', 0)} code lines.",
        "strengths": ["Repository structure was successfully parsed.", "Static analysis produced deterministic findings."],
        "priorities": ["Review security findings first.", "Document architecture and local setup clearly.", "Break down unusually large functions."],
        "architecture_explanation": "The architecture view is derived from top-level folders and detected imports; configure an AI key for deeper project-specific reasoning.",
        "engineering_questions": [
            "What are the main architectural boundaries in this repository?",
            "Where would you add tests first and why?",
            "What would you change before deploying this project to production?",
        ],
    }


def generate_questions(context: dict, count: int) -> list[str]:
    prompt = f"""
Create exactly {count} interview questions about this specific repository. Questions should test whether the developer understands their own implementation, architecture, tradeoffs, backend, security, and deployment. Avoid generic textbook questions. Return JSON: {{"questions":[...]}}.
Repository evidence:
{json.dumps(context, ensure_ascii=False)[:50000]}
"""
    result = _call_json(
        "You are a technical interviewer. Ask concise but probing software engineering questions.",
        prompt,
    )
    if result and isinstance(result.get("questions"), list):
        return [str(q) for q in result["questions"][:count]]
    base = context.get("ai_insights", {}).get("engineering_questions", [])
    fallback = base + [
        "Explain the request flow through the main components of this repository.",
        "Which part of this codebase would you refactor first and why?",
        "What security risk would you test for before production deployment?",
        "How would you make the repository analysis more scalable for a much larger codebase?",
        "What would happen if the primary database became unavailable?",
        "How would you design automated tests for the most important behavior here?",
        "Which dependency or architectural decision would you reconsider, and what would you replace it with?",
        "How would you monitor this application in production?",
    ]
    return fallback[:count]


def evaluate_answer(question: str, answer: str, context: dict) -> dict:
    prompt = f"""
Evaluate the developer answer to this repository-specific interview question.
Return JSON with keys: score (0-100 integer), verdict, strengths (array), gaps (array), ideal_answer_points (array), follow_up.
Question: {question}
Answer: {answer}
Repository evidence: {json.dumps(context, ensure_ascii=False)[:35000]}
Do not reward confident but unsupported claims.
"""
    result = _call_json(
        "You are a fair senior interviewer evaluating technical answers against repository evidence.",
        prompt,
    )
    if result:
        return result
    length = len(answer.strip())
    score = min(85, 35 + length // 25)
    return {
        "score": score,
        "verdict": "Promising answer" if score >= 60 else "Needs more technical detail",
        "strengths": ["The answer addresses the question." if length > 30 else "The answer is concise."],
        "gaps": ["Connect the explanation to concrete files or implementation details.", "Explain tradeoffs and failure cases."],
        "ideal_answer_points": ["Reference the repository's actual architecture.", "Explain the reasoning behind the design choice.", "Mention at least one tradeoff or edge case."],
        "follow_up": "Which concrete file or component demonstrates that decision?",
    }
