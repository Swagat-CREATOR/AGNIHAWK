# AgniHawk Architecture — Technical Deep-Dive

This document explains how AgniHawk works under the hood, focusing on our Pathway integration and the real-time data flow.

## Why Pathway?

The hackathon required a system that "updates automatically when new data arrives." That's literally what Pathway does — it's a streaming engine that continuously processes data, maintains live indexes, and pushes updates downstream without polling or manual triggers.

We use Pathway for:
1. **Data ingestion** — `pw.demo.generate_custom_stream()` for simulated IoT sensor feeds
2. **Stream processing** — `Table.join()`, `Table.select()`, `pw.apply()`, `pw.if_else()`
3. **Output routing** — `pw.io.subscribe()` for callbacks, `pw.io.jsonlines.write()` for logging
4. **RAG** — `pw.xpacks.llm.DocumentStore` for live document indexing + retrieval
5. **Engine** — `pw.run()` is the heart of the system, it blocks and runs everything

## Data Flow

### 1. Sensor Streams (Connectors)

We have three independent data streams, all created with `pw.demo.generate_custom_stream()`:

**Thermal Sensors** (`connectors/thermal_sensor_stream.py`)
- 6 landfill sectors at Ghazipur, Delhi
- Each reading: sector_id, temperature_celsius, depth_meters, lat/lon, timestamp
- Sector 4 gradually ramps up temperature to simulate an approaching fire event
- Rate: 2 readings/sec, autocommit every 1000ms

**Methane Sensors** (`connectors/methane_stream.py`)
- Same 6 sectors, measuring CH4, CO2, and CO gas levels
- Sector 4 shows correlated methane buildup (gas generation increases with heat)
- CO is the critical one — it spikes before actual combustion
- Random 3% chance of "gas pocket release" spikes (this happens in real landfills)
- Rate: 1.5 readings/sec

**Weather Data** (`connectors/weather_stream.py`)
- Global weather for the landfill area (not per-sector)
- Simulates a hot, dry, windy day — worst case for fire risk
- Has provision for live OpenWeatherMap API if API key is provided
- Rate: 0.5 readings/sec (every 2 seconds)

### 2. Risk Engine (Transforms)

The `transforms/risk_engine.py` is where the actual analysis happens. It's a chain of Pathway table operations:

```
thermal_table ──┐
                ├── Table.join(sector_id) ── Table.select() ── Table.select() ── Table.select()
methane_table ──┘         ↑                      ↑                   ↑                ↑
                    streaming join        compute temp/ch4/co   sum + weather     attach risk
                    by sector_id          risk sub-scores       penalty           level + message
```

**Risk scoring breakdown:**
- Temperature score (0-40 pts): piecewise linear based on thresholds at 60°C, 75°C, 85°C
- Methane score (0-30 pts): thresholds at 400, 600, 800 ppm
- CO score (0-15 pts): >30 ppm indicates pre-combustion
- Weather penalty (+10-15 pts): flat addition for worst-case conditions

All computed using `pw.if_else()` for conditional logic and `pw.apply()` for Python functions.

### 3. Output Pipeline

**`pw.io.subscribe()`** hooks into the risk alerts table. Every time a row changes, the callback fires and pushes the data to the Flask API's shared state. The Flask SSE endpoint then streams it to the browser.

**`pw.io.jsonlines.write()`** dumps every risk alert to `output/risk_alerts.jsonl` for post-analysis.

### 4. RAG Document Store

Uses Pathway's xPack for LLM integration:
- `pw.io.fs.read()` ingests text files from `rag/fire_safety_docs/`
- `TokenCountSplitter` chunks them (50-300 tokens each)
- `SentenceTransformerEmbedder` creates 384-dim embeddings locally (no API key)
- `DocumentStore` maintains a live hybrid index (semantic + BM25 search)
- `DocumentStoreServer` exposes it on port 8765

The store watches the docs directory — if you add/modify files while the pipeline is running, the index updates automatically. That's the Pathway promise.

### 5. LLM Narratives

The `llm/risk_narrator.py` calls HuggingFace's inference API (Mistral 7B) for human-readable risk assessments. Falls back to template-based narratives if the API is unavailable.

The frontend can request narratives via `/api/narrative/<sector_id>`.

## Frontend Architecture

The frontend is a single-page app built on CesiumJS:

- **`pathway_stream.js`** connects to the backend SSE at `localhost:5000/api/stream`
- **`app.js`** drives the Cesium globe, processes incoming data, updates markers and alerts
- **`aqi_simulator.js`** computes and displays Air Quality Index data
- **`safe_routes.js`** handles evacuation route calculation and turn-by-turn navigation
- **`style.css`** provides the tactical dark theme

## Demo Narrative

When you start the pipeline, here's what happens over time:

1. **Minutes 0-5:** All sectors show GREEN risk. Normal temperatures (45-60°C), low gas levels.
2. **Minutes 5-15:** Sectors 3 and 4 start warming up. Methane rises. Risk moves to YELLOW.
3. **Minutes 15-30:** Sector 4 crosses ORANGE threshold. CO levels spike. Alert narratives appear.
4. **Minutes 30+:** Sector 4 hits RED/BLACK. Temperature approaches 95°C. Estimated combustion time displayed. Full alert cascade triggers.

This simulates a realistic timeline — real landfill fires don't happen instantly, they build up over hours/days through accelerating decomposition cycles.
