# LLM-powered risk narrative generator
# sends sensor data to huggingface inference API (mistral 7B)
# and gets back a human-readable risk assessment
# falls back to templates if the API times out or no key is set

import pathway as pw  # imported for consistency with the rest of the pipeline
import os


SYSTEM_PROMPT = """You are AgniHawk, an AI fire risk analyst for Indian landfill sites.
You get real-time sensor readings and need to produce concise, actionable risk assessments.

Guidelines:
1. State the risk level clearly (GREEN/YELLOW/ORANGE/RED/BLACK)
2. Explain what's driving the risk (temperature, methane, CO, weather)
3. Give specific actionable recommendations
4. If RED or BLACK, include evacuation instructions
5. Keep it to 3-4 sentences max

Fire safety context from our RAG store will be provided when available.
Reference specific thresholds from the context if relevant."""


def _build_prompt(name, score, level, temp, ch4, co, wind, hum, eta, ctx=""):
    return f"""REAL-TIME SENSOR DATA:
- Sector: {name}
- Fire Risk Score: {score}/100 ({level})
- Sub-surface Temperature: {temp}°C
- Methane (CH4): {ch4} ppm
- Carbon Monoxide (CO): {co} ppm
- Wind Speed: {wind} km/h
- Humidity: {hum}%
- Est. Time to Combustion: {eta} minutes

FIRE SAFETY CONTEXT:
{ctx if ctx else "No additional context available."}

Generate a concise risk assessment and actionable recommendation."""


def generate_narrative_for_alert(alert_data, rag_ctx=""):
    """main entry point. tries HF API, falls back to template."""
    hf_key = os.getenv("HUGGINGFACE_API_KEY", "") or os.getenv("HF_TOKEN", "")

    prompt = _build_prompt(
        name=alert_data.get("sector_name", "Unknown"),
        score=alert_data.get("fire_risk_score", 0),
        level=alert_data.get("risk_level", "GREEN"),
        temp=alert_data.get("temperature_celsius", 0),
        ch4=alert_data.get("methane_ppm", 0),
        co=alert_data.get("carbon_monoxide_ppm", 0),
        wind=alert_data.get("wind_speed_kmh", 0),
        hum=alert_data.get("humidity_pct", 0),
        eta=alert_data.get("estimated_minutes_to_combustion", -1),
        ctx=rag_ctx,
    )

    if not hf_key:
        return _fallback(alert_data)

    try:
        import requests

        url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
        headers = {"Authorization": f"Bearer {hf_key}"}
        full = f"<s>[INST] {SYSTEM_PROMPT}\n\n{prompt} [/INST]"

        resp = requests.post(url, headers=headers, json={
            "inputs": full,
            "parameters": {
                "max_new_tokens": 300,
                "temperature": 0.3,
                "return_full_text": False,
            },
        }, timeout=30)
        resp.raise_for_status()
        result = resp.json()

        if isinstance(result, list) and len(result) > 0:
            return result[0].get("generated_text", _fallback(alert_data))
        return _fallback(alert_data)

    except Exception as e:
        print(f"[llm] HF API error: {e}")
        return _fallback(alert_data)


def _fallback(data):
    """template-based narratives when the LLM isn't available"""
    level = data.get("risk_level", "GREEN")
    name  = data.get("sector_name", "Unknown")
    score = data.get("fire_risk_score", 0)
    temp  = data.get("temperature_celsius", 0)
    ch4   = data.get("methane_ppm", 0)
    co    = data.get("carbon_monoxide_ppm", 0)
    eta   = data.get("estimated_minutes_to_combustion", -1)

    if level in ("BLACK", "RED"):
        msg = (
            f"🚨 CRITICAL — {name}: Risk {score:.0f}/100 ({level}). "
            f"Temp {temp:.1f}°C, CH4 {ch4:.0f}ppm, CO {co:.1f}ppm. "
        )
        if eta >= 0:
            msg += f"Combustion est. in {eta:.0f}min. "
        msg += "EVACUATE immediately — all workers in this sector and adjacent zones."
        return msg

    elif level == "ORANGE":
        return (
            f"⚠️ HIGH RISK — {name}: {score:.0f}/100. "
            f"Temp {temp:.1f}°C, CH4 {ch4:.0f}ppm. "
            f"Prepare evacuation routes. Deploy pre-wetting teams."
        )
    elif level == "YELLOW":
        return (
            f"📊 ELEVATED — {name}: {score:.0f}/100. "
            f"Temp {temp:.1f}°C. Increasing monitoring frequency."
        )
    else:
        return f"✅ NORMAL — {name}: {score:.0f}/100. All readings within safe range."
