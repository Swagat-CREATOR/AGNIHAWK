# REST API + SSE endpoint
# runs flask in a background thread alongside the pathway engine
# the cesium frontend connects here for live data

import json, time, threading
from flask import Flask, jsonify, Response, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# shared state between pathway callbacks and flask endpoints
_state = {
    "sectors": {},
    "alerts": [],
    "weather": {},
    "last_update": 0,
    "status": "initializing",
}
_lock = threading.Lock()


def update_sector_data(sector_id, data):
    """called from the pathway on_change callback"""
    with _lock:
        _state["sectors"][sector_id] = data
        _state["last_update"] = time.time()

        # track active alerts (RED/BLACK only)
        if data.get("risk_level") in ("RED", "BLACK"):
            entry = {**data, "alert_time": time.time()}
            # one alert per sector, replace old one
            _state["alerts"] = [
                a for a in _state["alerts"]
                if a.get("sector_id") != sector_id
            ]
            _state["alerts"].append(entry)
            # cap at 20
            _state["alerts"] = _state["alerts"][-20:]


def update_weather_data(data):
    with _lock:
        _state["weather"] = data


def set_pipeline_status(s):
    with _lock:
        _state["status"] = s


# ----------- endpoints -----------

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "pipeline": _state["status"],
        "last_updated": _state["last_update"],
        "uptime": time.time(),
    })


@app.route("/api/sectors")
def get_sectors():
    with _lock:
        sectors = list(_state["sectors"].values())
    return jsonify({"sectors": sectors, "count": len(sectors), "timestamp": time.time()})


@app.route("/api/sectors/<int:sid>")
def get_sector(sid):
    with _lock:
        s = _state["sectors"].get(sid)
    if not s:
        return jsonify({"error": f"sector {sid} not found"}), 404
    return jsonify(s)


@app.route("/api/alerts")
def get_alerts():
    with _lock:
        alerts = list(_state["alerts"])
    return jsonify({"alerts": alerts, "count": len(alerts), "timestamp": time.time()})


@app.route("/api/weather")
def get_weather():
    with _lock:
        w = dict(_state["weather"])
    return jsonify(w)


@app.route("/api/stream")
def stream_updates():
    """SSE endpoint — the frontend opens an EventSource to this.
    pushes new data whenever the pathway engine updates state."""
    def generate():
        last_sent = 0
        while True:
            with _lock:
                ts = _state["last_update"]
                if ts > last_sent:
                    payload = {
                        "sectors": list(_state["sectors"].values()),
                        "alerts": list(_state["alerts"]),
                        "weather": dict(_state["weather"]),
                        "timestamp": time.time(),
                    }
                    last_sent = ts
                    yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(1)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.route("/api/narrative/<int:sid>")
def get_narrative(sid):
    """ask the LLM to generate a risk narrative for this sector"""
    with _lock:
        sector = _state["sectors"].get(sid)
    if not sector:
        return jsonify({"error": f"sector {sid} not found"}), 404

    try:
        from llm.risk_narrator import generate_narrative_for_alert
        text = generate_narrative_for_alert(sector)
        return jsonify({"sector_id": sid, "narrative": text, "timestamp": time.time()})
    except Exception as e:
        # fallback to the alert message if LLM fails
        return jsonify({
            "sector_id": sid,
            "narrative": sector.get("alert_message", "unavailable"),
            "error": str(e),
            "timestamp": time.time(),
        })


def start_api_server(port=5000):
    """kick off flask in a daemon thread so it doesn't block pathway"""
    def _run():
        print(f"[api] starting on http://localhost:{port}")
        app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return t
