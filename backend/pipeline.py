# agnihawk main pipeline
# wires everything together:
#   1. starts flask API
#   2. creates the three data streams (thermal, methane, weather)
#   3. feeds them into the risk engine
#   4. hooks up output callbacks to push data to API
#   5. optionally starts the RAG document store
#   6. calls pw.run() which blocks and runs the streaming engine
#
# usage: python pipeline.py

import os, sys, time, threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import pathway as pw

from connectors.thermal_sensor_stream import create_thermal_stream
from connectors.methane_stream import create_methane_stream
from connectors.weather_stream import create_weather_stream
from transforms.risk_engine import build_risk_engine
from api.server import start_api_server, update_sector_data, update_weather_data, set_pipeline_status


def main():
    print("=" * 60)
    print("🔥 AgniHawk — Landfill Fire Prevention System")
    print("   powered by Pathway")
    print("=" * 60)
    print()

    # --- 1. flask API ---
    port = int(os.getenv("API_PORT", "5000"))
    print(f"[1/5] api server on port {port}...")
    start_api_server(port=port)
    set_pipeline_status("starting")
    time.sleep(1)

    # --- 2. data streams ---
    print("[2/5] spinning up data streams...")
    print("  → thermal sensors (6 sectors, 2/sec)")
    thermal = create_thermal_stream(input_rate=2.0)

    print("  → methane sensors (6 sectors, 1.5/sec)")
    methane = create_methane_stream(input_rate=1.5)

    print("  → weather data (1 reading / 2sec)")
    weather = create_weather_stream(input_rate=0.5)

    # --- 3. risk engine ---
    print("[3/5] building risk engine...")
    alerts = build_risk_engine(
        thermal_table=thermal,
        methane_table=methane,
        weather_table=weather,
    )

    # --- 4. output sinks ---
    print("[4/5] wiring outputs...")

    def on_risk(key, row, time_val, is_addition):
        """push each risk update to the flask API"""
        if not is_addition:
            return

        d = {
            "sector_id": row["sector_id"],
            "sector_name": row["sector_name"],
            "fire_risk_score": row["fire_risk_score"],
            "risk_level": row["risk_level"],
            "temperature_celsius": row["temperature_celsius"],
            "methane_ppm": row["methane_ppm"],
            "carbon_monoxide_ppm": row["carbon_monoxide_ppm"],
            "wind_speed_kmh": row["wind_speed_kmh"],
            "humidity_pct": row["humidity_pct"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "estimated_minutes_to_combustion": row["estimated_minutes_to_combustion"],
            "alert_message": row["alert_message"],
            "timestamp": row["timestamp"],
        }
        update_sector_data(row["sector_id"], d)

        # print critical alerts to terminal
        lvl = row["risk_level"]
        if lvl in ("RED", "BLACK"):
            print(f"\n🚨 {row['alert_message']}")
        elif lvl == "ORANGE":
            print(f"\n⚠️  {row['alert_message']}")

    pw.io.subscribe(alerts, on_change=on_risk)

    # also dump to jsonl for later analysis
    pw.io.jsonlines.write(alerts, "./output/risk_alerts.jsonl")

    # weather updates
    def on_weather(key, row, time_val, is_addition):
        if is_addition:
            update_weather_data({
                "wind_speed_kmh": row["wind_speed_kmh"],
                "wind_direction_deg": row["wind_direction_deg"],
                "humidity_pct": row["humidity_pct"],
                "temperature_ambient": row["temperature_ambient"],
                "pressure_hpa": row["pressure_hpa"],
                "timestamp": row["timestamp"],
            })

    pw.io.subscribe(weather, on_change=on_weather)

    # --- 5. RAG document store ---
    print("[5/5] document store (RAG)...")
    try:
        from rag.document_store import create_document_store
        store, srv = create_document_store()
        srv.run(threaded=True, with_cache=False)
        print(f"  → RAG running on port {os.getenv('PATHWAY_PORT', '8765')}")
    except Exception as e:
        print(f"  → RAG skipped: {e}")

    # --- go! ---
    set_pipeline_status("running")
    print()
    print("=" * 60)
    print("✅ pipeline is LIVE")
    print(f"   api:     http://localhost:{port}/api/sectors")
    print(f"   alerts:  http://localhost:{port}/api/alerts")
    print(f"   stream:  http://localhost:{port}/api/stream")
    print(f"   health:  http://localhost:{port}/api/health")
    rag_port = os.getenv("PATHWAY_PORT", "8765")
    print(f"   rag:     http://localhost:{rag_port}/v1/retrieve")
    print("=" * 60)
    print()
    print("streaming... Ctrl+C to stop")
    print()

    # this blocks forever — pathway's streaming engine takes over
    pw.run(monitoring_level=pw.MonitoringLevel.NONE)


if __name__ == "__main__":
    os.makedirs("./output", exist_ok=True)
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 stopped.")
        sys.exit(0)
