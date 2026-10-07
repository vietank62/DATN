"""Server-only structured JSON calls; no automatic cross-provider fallback."""
import os
import re

import httpx


def provider_name():
    return os.getenv("LLM_PROVIDER", "gemini").strip().lower()


def _response_text(payload):
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for output in payload.get("output", []):
        for content in output.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    return ""


def structured_output(instructions, input_text, schema, name, timeout=45):
    provider = provider_name()
    if provider == "gemini":
        key = os.getenv("GEMINI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("Chưa cấu hình GEMINI_API_KEY cho dịch vụ AI. Vui lòng thử lại sau.")
        model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
        if not re.fullmatch(r"gemini-[a-zA-Z0-9.-]+", model):
            raise RuntimeError("GEMINI_MODEL chưa hợp lệ. Vui lòng kiểm tra cấu hình AI.")
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key}, timeout=timeout,
            json={"systemInstruction": {"parts": [{"text": instructions}]},
                  "contents": [{"role": "user", "parts": [{"text": input_text}]}],
                  "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema}},
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Invalid Gemini response")
        candidates = payload.get("candidates") or []
        if not candidates or not isinstance(candidates[0], dict) or candidates[0].get("finishReason") != "STOP":
            raise ValueError("Gemini response blocked or incomplete")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part["text"] for part in parts
                       if isinstance(part, dict) and isinstance(part.get("text"), str) and not part.get("thought"))
        if not text:
            raise ValueError("Empty Gemini response")
        return text
    if provider == "openai":
        key = os.getenv("OPENAI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("AI chưa được cấu hình. Vui lòng thử lại sau.")
        response = httpx.post("https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {key}"}, timeout=timeout,
            json={"model": os.getenv("OPENAI_MODEL", "gpt-5-mini"), "store": False,
                  "instructions": instructions, "input": input_text,
                  "text": {"format": {"type": "json_schema", "name": name, "strict": True, "schema": schema}}})
        response.raise_for_status()
        return _response_text(response.json())
    raise RuntimeError("AI chưa được cấu hình. Vui lòng thử lại sau.")
