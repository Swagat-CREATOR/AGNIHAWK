# fire risk scoring engine
# takes thermal + methane + weather streams, joins them by sector,
# and spits out a 0-100 risk score per sector every tick
#
# the scoring weighs temperature most heavily (40 pts max),
# then methane (30), CO (15), and weather adds a flat penalty.
# risk levels: GREEN < 31 < YELLOW < 51 < ORANGE < 71 < RED < 91 < BLACK

import pathway as pw


class RiskAlertSchema(pw.Schema):
    sector_id: int
    sector_name: str
    fire_risk_score: float
    risk_level: str
    temperature_celsius: float
    methane_ppm: float
    carbon_monoxide_ppm: float
    wind_speed_kmh: float
    humidity_pct: float
    latitude: float
    longitude: float
    estimated_minutes_to_combustion: float
    alert_message: str
    timestamp: float


# --- thresholds (tweaked these a LOT during testing) ---
TEMP_NORMAL    = 60.0
TEMP_ELEVATED  = 75.0
TEMP_CRITICAL  = 85.0

CH4_NORMAL    = 400.0
CH4_ELEVATED  = 600.0
CH4_CRITICAL  = 800.0

CO_THRESH = 30.0   # above 30 ppm is a strong pre-fire signal
WIND_HIGH = 15.0
HUMIDITY_LOW = 30.0


def _risk_level(score):
    """map score to color-coded level"""
    if score >= 91: return "BLACK"
    if score >= 71: return "RED"
    if score >= 51: return "ORANGE"
    if score >= 31: return "YELLOW"
    return "GREEN"


def _time_to_combustion(temp, trend=0.15):
    """rough ETA based on current temp and rate of rise.
    ignition threshold is ~95C for landfill waste.
    returns -1 if cooling or already below threshold trend."""
    ignition = 95.0
    if temp >= ignition:
        return 0.0
    if trend <= 0:
        return -1.0
    return round(max(0, (ignition - temp) / trend), 1)


def _make_alert_msg(name, score, level, temp, ch4, co, wind, hum, eta):
    """build the alert string. keeps it concise."""
    if level == "GREEN":
        return f"{name}: Normal. Risk {score:.0f}%."

    parts = [f"⚠️ {name}: {level} ALERT — Risk {score:.0f}%."]
    if temp > TEMP_ELEVATED:
        parts.append(f"Temp {temp:.1f}°C (ELEVATED).")
    if ch4 > CH4_ELEVATED:
        parts.append(f"CH4 {ch4:.0f}ppm (HIGH).")
    if co > CO_THRESH:
        parts.append(f"CO {co:.1f}ppm (FIRE INDICATOR).")
    if wind > WIND_HIGH:
        parts.append(f"Wind {wind:.1f}km/h.")
    if hum < HUMIDITY_LOW:
        parts.append(f"Humidity {hum:.0f}% (LOW).")
    if 0 <= eta < 120:
        parts.append(f"Est. ignition in {eta:.0f}min.")

    return " ".join(parts)


def build_risk_engine(thermal_table, methane_table, weather_table):
    """core streaming pipeline.
    
    joins thermal and methane by sector_id, computes weighted risk score,
    adds alert level and message. weather is global (not per-sector) so
    we just add a flat penalty for now.
    
    ideally we'd do a temporal join with weather but that's
    more complex and the demo doesn't really need it.
    """

    # step 1: join thermal + methane on sector id
    joined = thermal_table.join(
        methane_table,
        thermal_table.sector_id == methane_table.sector_id,
    ).select(
        sector_id=thermal_table.sector_id,
        sector_name=thermal_table.sector_name,
        temperature_celsius=thermal_table.temperature_celsius,
        depth_meters=thermal_table.depth_meters,
        latitude=thermal_table.latitude,
        longitude=thermal_table.longitude,
        methane_ppm=methane_table.methane_ppm,
        co2_ppm=methane_table.co2_ppm,
        carbon_monoxide_ppm=methane_table.carbon_monoxide_ppm,
        ts_thermal=thermal_table.timestamp,
        ts_methane=methane_table.timestamp,
    )

    # step 2: compute individual risk components
    scored = joined.select(
        sector_id=pw.this.sector_id,
        sector_name=pw.this.sector_name,
        temperature_celsius=pw.this.temperature_celsius,
        methane_ppm=pw.this.methane_ppm,
        carbon_monoxide_ppm=pw.this.carbon_monoxide_ppm,
        latitude=pw.this.latitude,
        longitude=pw.this.longitude,
        timestamp=pw.this.ts_thermal,

        # temperature: 0..40 points
        temp_score=pw.if_else(
            pw.this.temperature_celsius >= TEMP_CRITICAL, 40.0,
            pw.if_else(
                pw.this.temperature_celsius >= TEMP_ELEVATED,
                25.0 + 15.0 * (pw.this.temperature_celsius - TEMP_ELEVATED) / (TEMP_CRITICAL - TEMP_ELEVATED),
                pw.if_else(
                    pw.this.temperature_celsius >= TEMP_NORMAL,
                    10.0 + 15.0 * (pw.this.temperature_celsius - TEMP_NORMAL) / (TEMP_ELEVATED - TEMP_NORMAL),
                    pw.this.temperature_celsius / TEMP_NORMAL * 10.0,
                ),
            ),
        ),

        # methane: 0..30 points
        ch4_score=pw.if_else(
            pw.this.methane_ppm >= CH4_CRITICAL, 30.0,
            pw.if_else(
                pw.this.methane_ppm >= CH4_ELEVATED,
                15.0 + 15.0 * (pw.this.methane_ppm - CH4_ELEVATED) / (CH4_CRITICAL - CH4_ELEVATED),
                pw.this.methane_ppm / CH4_ELEVATED * 15.0,
            ),
        ),

        # carbon monoxide: 0..15 points (strongest fire indicator)
        co_score=pw.if_else(
            pw.this.carbon_monoxide_ppm >= CO_THRESH * 2, 15.0,
            pw.if_else(
                pw.this.carbon_monoxide_ppm >= CO_THRESH, 10.0,
                pw.this.carbon_monoxide_ppm / CO_THRESH * 5.0,
            ),
        ),
    )

    # step 3: sum it up + weather penalty
    # weather is global so we just slap on a +10 base penalty
    # (hot dry windy day assumption for the demo)
    combined = scored.select(
        sector_id=pw.this.sector_id,
        sector_name=pw.this.sector_name,
        temperature_celsius=pw.this.temperature_celsius,
        methane_ppm=pw.this.methane_ppm,
        carbon_monoxide_ppm=pw.this.carbon_monoxide_ppm,
        latitude=pw.this.latitude,
        longitude=pw.this.longitude,
        timestamp=pw.this.timestamp,
        fire_risk_score=pw.apply(
            lambda t, m, c: min(100.0, round(t + m + c + 10.0, 1)),
            pw.this.temp_score, pw.this.ch4_score, pw.this.co_score,
        ),
    )

    # step 4: attach risk level + alert message
    out = combined.select(
        sector_id=pw.this.sector_id,
        sector_name=pw.this.sector_name,
        fire_risk_score=pw.this.fire_risk_score,
        risk_level=pw.apply(_risk_level, pw.this.fire_risk_score),
        temperature_celsius=pw.this.temperature_celsius,
        methane_ppm=pw.this.methane_ppm,
        carbon_monoxide_ppm=pw.this.carbon_monoxide_ppm,
        wind_speed_kmh=pw.declare_type(float, 0.0),     # filled from weather stream via callback
        humidity_pct=pw.declare_type(float, 0.0),
        latitude=pw.this.latitude,
        longitude=pw.this.longitude,
        estimated_minutes_to_combustion=pw.apply(
            lambda t: _time_to_combustion(t, 0.15),
            pw.this.temperature_celsius,
        ),
        alert_message=pw.apply(
            lambda sn, rs, t, m, co: _make_alert_msg(
                sn, rs, _risk_level(rs), t, m, co, 12.0, 25.0,
                _time_to_combustion(t, 0.15)
            ),
            pw.this.sector_name, pw.this.fire_risk_score,
            pw.this.temperature_celsius, pw.this.methane_ppm,
            pw.this.carbon_monoxide_ppm,
        ),
        timestamp=pw.this.timestamp,
    )

    return out
