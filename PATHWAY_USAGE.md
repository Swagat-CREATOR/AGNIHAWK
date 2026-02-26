# Pathway Framework Usage — Compliance Checklist

This doc shows exactly where and how we use the Pathway library, organized by the requirements from the hackathon PDF.

---

## ✅ Requirement 1: Live Data Ingestion with Pathway Connectors

> *"Your system must utilize Pathway's real-time connectors to ingest streaming data."*

We use `pw.demo.generate_custom_stream()` — Pathway's built-in module for artificial data streams (recommended in the hackathon PDF for when live APIs are unavailable). Three independent streams run concurrently:

| Stream | File | Rate | Produces |
|--------|------|------|----------|
| Thermal | [`thermal_sensor_stream.py`](backend/connectors/thermal_sensor_stream.py) | 2/sec | Temperature per sector |
| Methane | [`methane_stream.py`](backend/connectors/methane_stream.py) | 1.5/sec | CH4, CO2, CO per sector |
| Weather | [`weather_stream.py`](backend/connectors/weather_stream.py) | 0.5/sec | Wind, humidity, temp, pressure |

**Code snippet** (`thermal_sensor_stream.py:79-87`):
```python
return pw.demo.generate_custom_stream(
    fns,
    schema=ThermalSensorSchema,
    nb_rows=None,       # run forever
    input_rate=input_rate,
    autocommit_duration_ms=1000,
)
```

**RAG document ingestion** (`document_store.py:34`):
```python
docs = pw.io.fs.read(docs_dir, format="binary", with_metadata=True)
```

---

## ✅ Requirement 2: Core Concepts

> *"Familiarize yourself with Pathway's foundational ideas: incremental computation, table semantics, and event-driven design."*

Our entire risk engine is built on Pathway tables:
- Each connector returns a `pw.Table`
- Tables are joined, transformed, and subscribed to
- All processing is incremental — when a new row arrives, only the affected outputs recompute
- `pw.run()` drives the event loop, we never poll

---

## ✅ Requirement 3: Streaming Transformations

> *"All data transformations must be in streaming mode using Pathway's transformation APIs."*

**File:** [`risk_engine.py`](backend/transforms/risk_engine.py)

**Streaming join** (line 97):
```python
joined = thermal_table.join(
    methane_table,
    thermal_table.sector_id == methane_table.sector_id,
).select(...)
```

**Feature engineering with pw.if_else** (line 120-140):
```python
temp_score=pw.if_else(
    pw.this.temperature_celsius >= TEMP_CRITICAL, 40.0,
    pw.if_else(
        pw.this.temperature_celsius >= TEMP_ELEVATED,
        25.0 + 15.0 * (pw.this.temperature_celsius - TEMP_ELEVATED) / ...
        ...
    ),
),
```

**Applying Python functions to streams** (line 150):
```python
fire_risk_score=pw.apply(
    lambda t, m, c: min(100.0, round(t + m + c + 10.0, 1)),
    pw.this.temp_score, pw.this.ch4_score, pw.this.co_score,
),
```

**Column references via pw.this** — used 30+ times across `risk_engine.py`.

---

## ✅ Requirement 4: LLM Integration (Pathway xPack)

> *"Integrate Pathway's LLM xPack for retrieval, summarization, and reasoning."*

**File:** [`document_store.py`](backend/rag/document_store.py)

```python
from pathway.xpacks.llm.document_store import DocumentStore
from pathway.xpacks.llm.servers import DocumentStoreServer
from pathway.xpacks.llm.splitters import TokenCountSplitter
from pathway.xpacks.llm.embedders import SentenceTransformerEmbedder
```

- Documents indexed: fire chemistry, evacuation protocols, Indian landfill data
- Embeddings: SentenceTransformers (local, no API key)
- Index stays live and auto-updates when docs change
- Server runs on port 8765 for retrieval queries

**LLM runtime:** HuggingFace Mistral-7B via inference API for generating plain-language risk narratives from sensor data ([`risk_narrator.py`](backend/llm/risk_narrator.py)).

---

## ✅ Requirement 5: Output Sinks

> *"Ensure computations are low-latency and modular, with clear separation between ingestion, transformation, and output."*

**Subscription-based output** (`pipeline.py:67`):
```python
pw.io.subscribe(alerts, on_change=on_risk)
```

**File output** (`pipeline.py:82`):
```python
pw.io.jsonlines.write(alerts, "./output/risk_alerts.jsonl")
```

**Engine startup** (`pipeline.py:115`):
```python
pw.run(monitoring_level=pw.MonitoringLevel.NONE)
```

---

## ✅ The One-Line Rule

> *"If your system does not update automatically when new data arrives, it is not a Pathway project."*

**Our system auto-updates.** Here's the chain:

1. `pw.demo.generate_custom_stream()` continuously produces new sensor rows
2. `pw.run()` processes them through joins and transforms incrementally
3. `pw.io.subscribe()` fires callbacks on every new risk score
4. Callbacks push data to Flask SSE endpoint
5. Frontend receives updates via `EventSource` — zero polling

**Nothing requires manual intervention.** Data flows from sensors → risk engine → API → browser, all reactively.

---

## Summary Table

| Pathway API | Count | Files |
|-------------|-------|-------|
| `import pathway as pw` | 7 | All backend .py files |
| `pw.Schema` | 4 | All connectors + risk_engine |
| `pw.demo.generate_custom_stream()` | 3 | All connectors |
| `pw.Table.join()` | 1 | risk_engine.py |
| `pw.Table.select()` | 3 | risk_engine.py (chained) |
| `pw.this` | 30+ | risk_engine.py |
| `pw.if_else()` | 6 | risk_engine.py |
| `pw.apply()` | 3 | risk_engine.py |
| `pw.declare_type()` | 2 | risk_engine.py |
| `pw.io.subscribe()` | 2 | pipeline.py |
| `pw.io.jsonlines.write()` | 1 | pipeline.py |
| `pw.io.fs.read()` | 1 | document_store.py |
| `pw.xpacks.llm.*` | 4 | document_store.py |
| `pw.run()` | 1 | pipeline.py |
| **Total unique Pathway APIs** | **14** | |
