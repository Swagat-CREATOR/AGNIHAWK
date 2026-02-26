# AgniHawk 🔥 — Predictive Landfill Fire Prevention System

> **Real-time AI-powered fire risk prediction for Indian landfills, built on [Pathway](https://pathway.com) framework**

AgniHawk monitors landfill sites using simulated IoT sensor streams (temperature, methane, CO), processes them through a streaming risk engine, and visualizes everything on an interactive 3D globe. The system predicts fires *before* they happen and guides people to safety through evacuation routing.

Built for the **Hack For Green Bharat** hackathon.

---

## 🎯 What It Does

The name says it — **AgniHawk** ("Agni" = fire in Sanskrit, "Hawk" = watchful eye). It watches landfills for signs of underground fires and warns operators before things get dangerous.

**Real problem:** Indian mega-landfills like Ghazipur (Delhi), Deonar (Mumbai), and Brahmapuram (Kochi) catch fire regularly. Ghazipur alone has had 5+ major fires in recent years. These fires release toxic dioxins, PM2.5, and burn for days. The 2022 Ghazipur fire burned for over 3 days straight.

**Our solution:** A streaming data pipeline that continuously monitors temperature, methane, and carbon monoxide levels across landfill sectors, computes a fire risk score in real-time, and triggers alerts when conditions approach combustion thresholds.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PATHWAY STREAMING ENGINE                     │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Thermal    │  │   Methane    │  │   Weather    │          │
│  │   Sensors    │  │   Sensors    │  │    Data      │          │
│  │ (pw.demo)    │  │ (pw.demo)    │  │ (pw.demo)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └────────┬────────┘                  │                   │
│                  ▼                           │                   │
│         ┌────────────────┐                   │                   │
│         │  Table.join()  │ ← streaming join  │                   │
│         │  by sector_id  │   on sector_id    │                   │
│         └───────┬────────┘                   │                   │
│                 ▼                            │                   │
│         ┌────────────────┐                   │                   │
│         │  Risk Engine   │ ← pw.apply(),     │                   │
│         │  (0-100 score) │   pw.if_else()    │                   │
│         └───────┬────────┘                   │                   │
│                 │                            │                   │
│     ┌───────────┼────────────────────────────┘                   │
│     │           │                                                │
│     ▼           ▼                                                │
│  ┌──────┐  ┌──────────┐  ┌───────────────┐                     │
│  │ SSE  │  │ JSONL    │  │  RAG Store    │                     │
│  │ API  │  │ Logging  │  │ (pw.xpacks)  │                     │
│  └──┬───┘  └──────────┘  └──────┬────────┘                     │
│     │         pw.io.*            │                               │
└─────┼────────────────────────────┼───────────────────────────────┘
      │                            │
      ▼                            ▼
┌──────────────┐          ┌──────────────────┐
│   CesiumJS   │          │  LLM Narratives  │
│   3D Globe   │          │  (HuggingFace)   │
│   Frontend   │          │                  │
└──────────────┘          └──────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Streaming Engine** | [Pathway](https://pathway.com) | Real-time data ingestion, joins, transforms |
| **Data Sources** | `pw.demo.generate_custom_stream` | Simulated IoT sensor feeds |
| **Risk Analysis** | `pw.Table.join()` + `pw.apply()` | Streaming risk score computation |
| **RAG** | `pw.xpacks.llm.DocumentStore` | Fire safety knowledge retrieval |
| **Embeddings** | SentenceTransformers (all-MiniLM-L6-v2) | Local embeddings, no API key needed |
| **LLM** | HuggingFace Mistral-7B | Risk narrative generation |
| **API** | Flask + SSE | Real-time data push to frontend |
| **Visualization** | CesiumJS | 3D globe with interactive overlays |
| **Navigation** | Mapbox Directions API | Safe evacuation route guidance |

---

## 📁 Project Structure

```
HACK_FOR_GREEN/
├── backend/
│   ├── pipeline.py                 # main entry point — orchestrates everything
│   ├── requirements.txt            # python dependencies
│   ├── .env.example                # environment variables template
│   │
│   ├── connectors/                 # pathway data source connectors
│   │   ├── thermal_sensor_stream.py    # subsurface temperature sensors (6 sectors)
│   │   ├── methane_stream.py           # CH4 + CO + CO2 emission sensors
│   │   └── weather_stream.py           # weather data (simulated / OpenWeatherMap)
│   │
│   ├── transforms/                 # pathway streaming transforms
│   │   └── risk_engine.py              # fire risk scoring (joins + pw.apply)
│   │
│   ├── api/                        # REST API + SSE endpoint
│   │   └── server.py                   # flask server, runs in background thread
│   │
│   ├── rag/                        # retrieval-augmented generation
│   │   ├── document_store.py           # pathway xpack document store setup
│   │   └── fire_safety_docs/           # knowledge base documents
│   │       ├── landfill_fire_chemistry.txt
│   │       ├── evacuation_protocols.txt
│   │       └── india_landfill_data.txt
│   │
│   └── llm/                        # LLM integration
│       └── risk_narrator.py            # HuggingFace inference for narratives
│
├── frontend/
│   ├── index.html                  # main dashboard page
│   ├── app.js                      # cesium globe + UI logic
│   ├── style.css                   # tactical dark theme styling
│   ├── pathway_stream.js           # SSE connector to backend
│   ├── aqi_simulator.js            # air quality index visualization
│   └── safe_routes.js              # evacuation route guidance system
│
└── README.md                       # you are here
```

---

## 🚀 How to Run

### Prerequisites
- **Python 3.10+** (Linux only for Pathway — Ubuntu/WSL recommended)
- **pip** for Python dependencies

### 1. Clone and setup

```bash
git clone https://github.com/YOUR_USERNAME/agnihawk.git
cd agnihawk
```

### 2. Backend setup

```bash
cd backend

# create virtual environment
python -m venv .venv
source .venv/bin/activate

# install dependencies (pathway needs linux)
pip install -r requirements.txt

# configure environment
cp .env.example .env
# edit .env and add your HuggingFace API key (free at huggingface.co)
```

### 3. Start the pipeline

```bash
python pipeline.py
```

You should see output like:
```
============================================================
🔥 AgniHawk — Landfill Fire Prevention System
   powered by Pathway
============================================================

[1/5] api server on port 5000...
[2/5] spinning up data streams...
  → thermal sensors (6 sectors, 2/sec)
  → methane sensors (6 sectors, 1.5/sec)
  → weather data (1 reading / 2sec)
[3/5] building risk engine...
[4/5] wiring outputs...
[5/5] document store (RAG)...

✅ pipeline is LIVE
   api:     http://localhost:5000/api/sectors
   stream:  http://localhost:5000/api/stream
```

### 4. Start the frontend

In a second terminal:
```bash
cd frontend
python -m http.server 8000
```

Open **http://localhost:8000** in your browser. Data flows automatically.

---

## 🔑 Pathway Framework Usage

This project uses Pathway as the **core streaming engine**. Here's exactly where and how:

### Data Ingestion (Connectors)
| File | Pathway API | What it does |
|------|-------------|-------------|
| `thermal_sensor_stream.py` | `pw.demo.generate_custom_stream()` | Generates continuous thermal readings for 6 landfill sectors |
| `methane_stream.py` | `pw.demo.generate_custom_stream()` | Generates CH4, CO2, CO gas readings per sector |
| `weather_stream.py` | `pw.demo.generate_custom_stream()` | Simulates weather conditions (wind, humidity, temp) |

### Streaming Transforms (Risk Engine)
| API | Where | Purpose |
|-----|-------|---------|
| `pw.Schema` | All connectors + risk engine | Defines typed schemas for streaming tables |
| `Table.join()` | `risk_engine.py` | Joins thermal + methane streams by `sector_id` |
| `Table.select()` | `risk_engine.py` | Feature engineering — 3 chained selects |
| `pw.if_else()` | `risk_engine.py` | Conditional risk scoring logic |
| `pw.apply()` | `risk_engine.py` | Applies Python functions in streaming context |
| `pw.this` | `risk_engine.py` | Column references in streaming transforms |
| `pw.declare_type()` | `risk_engine.py` | Type declarations for computed columns |

### Output Sinks
| API | Where | Purpose |
|-----|-------|---------|
| `pw.io.subscribe()` | `pipeline.py` | Pushes risk updates + weather to Flask API via callbacks |
| `pw.io.jsonlines.write()` | `pipeline.py` | Logs all risk alerts to JSONL file |

### RAG Document Store
| API | Where | Purpose |
|-----|-------|---------|
| `pw.io.fs.read()` | `document_store.py` | Reads fire safety docs (live-watches directory) |
| `pw.xpacks.llm.DocumentStore` | `document_store.py` | Builds live hybrid search index |
| `pw.xpacks.llm.DocumentStoreServer` | `document_store.py` | Serves RAG queries on port 8765 |
| `pw.xpacks.llm.SentenceTransformerEmbedder` | `document_store.py` | Local embeddings (no API key needed) |
| `pw.xpacks.llm.TokenCountSplitter` | `document_store.py` | Chunks documents for indexing |

### Engine
| API | Where | Purpose |
|-----|-------|---------|
| `pw.run()` | `pipeline.py` | Starts the streaming engine — blocks and auto-updates |

> **Hackathon rule check:** ✅ *"If your system does not update automatically when new data arrives, it is not a Pathway project."* — Our system auto-updates via `pw.run()`, streaming joins, and `pw.io.subscribe()` callbacks. No polling, no manual refresh.

---

## 📊 Risk Scoring Algorithm

The fire risk score (0–100) is computed from three components:

| Component | Max Points | How It Works |
|-----------|-----------|--------------|
| **Temperature** | 40 | Piecewise linear: <60°C = low, 60-75°C = elevated, 75-85°C = high, >85°C = max |
| **Methane (CH4)** | 30 | <400 ppm = normal, 400-600 = elevated, 600-800 = high, >800 = max |
| **Carbon Monoxide (CO)** | 15 | >30 ppm is a strong pre-combustion indicator, >60 ppm = max |
| **Weather Penalty** | 15 | Hot + dry + windy conditions add a flat penalty |

**Risk Levels:**
- 🟢 **GREEN** (0-30): Normal operations
- 🟡 **YELLOW** (31-50): Elevated monitoring
- 🟠 **ORANGE** (51-70): High risk — prepare evacuation routes
- 🔴 **RED** (71-90): Critical — begin evacuation
- ⬛ **BLACK** (91-100): Imminent combustion — emergency protocol

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Pipeline health + uptime |
| GET | `/api/sectors` | Current risk data for all 6 sectors |
| GET | `/api/sectors/<id>` | Risk data for a specific sector |
| GET | `/api/alerts` | Active RED/BLACK level alerts |
| GET | `/api/weather` | Latest weather conditions |
| GET | `/api/stream` | **SSE endpoint** — real-time data push |
| GET | `/api/narrative/<id>` | LLM-generated risk assessment for a sector |

---

## 🖥️ Frontend Features

- **3D CesiumJS Globe** with Indian city markers and landfill overlays
- **Real-time risk visualization** — markers change color based on risk level
- **Live Risk Alerts** panel with LLM-generated narratives
- **Safe Evacuation Routes** — Google Maps-style turn-by-turn navigation
- **Live AQI Display** — city-wide and per-zone air quality monitoring
- **3D Buildings** via Cesium Ion (optional token)
- **Light/Dark Mode** toggle
- **Night Lights** satellite imagery overlay

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` in the `backend/` folder:

```env
# required for LLM narratives (free at huggingface.co/settings/tokens)
HUGGINGFACE_API_KEY=your_token_here

# optional — for live weather instead of simulation
OPENWEATHERMAP_API_KEY=your_key_here

# ports (defaults work fine)
PATHWAY_PORT=8765
API_PORT=5000
```

---

## 👥 Team

**Team AgniHawk** — Hack For Green Bharat 2026

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
