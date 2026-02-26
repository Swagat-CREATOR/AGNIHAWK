# thermal sensor data stream
# simulates the IoT temperature probes buried across the landfill grid
# each sector has a probe at varying depth - we model 6 sectors at Ghazipur

import pathway as pw
import random, math, time


class ThermalSensorSchema(pw.Schema):
    sector_id: int
    sector_name: str
    temperature_celsius: float
    depth_meters: float
    latitude: float
    longitude: float
    timestamp: float


# ghazipur landfill sector layout
# sector 4 is the "hot" one that'll ramp up during the demo
SECTORS = [
    {"id": 1, "name": "Sector-1-NW", "lat": 28.6230, "lon": 77.3255, "base_temp": 55.0},
    {"id": 2, "name": "Sector-2-NE", "lat": 28.6235, "lon": 77.3275, "base_temp": 52.0},
    {"id": 3, "name": "Sector-3-SW", "lat": 28.6210, "lon": 77.3258, "base_temp": 58.0},
    {"id": 4, "name": "Sector-4-SE", "lat": 28.6208, "lon": 77.3278, "base_temp": 60.0},
    {"id": 5, "name": "Sector-5-C",  "lat": 28.6220, "lon": 77.3268, "base_temp": 50.0},
    {"id": 6, "name": "Sector-6-E",  "lat": 28.6218, "lon": 77.3290, "base_temp": 48.0},
]


def _gen_thermal(idx):
    """one reading per call. sector 4 slowly gets hotter to mimic approaching ignition."""
    sec = SECTORS[idx % len(SECTORS)]
    elapsed = idx // len(SECTORS)  # how many full cycles we've done

    # sinusoidal daily variation, nothing fancy
    daily = 3.0 * math.sin(elapsed * math.pi / 360)
    noise = random.gauss(0, 1.5)

    # the interesting part — sector 4 ramps up gradually
    ramp = 0.0
    if sec["id"] == 4:
        ramp = min(elapsed * 0.15, 35.0)  # caps at +35 degrees above baseline
    elif sec["id"] == 3:
        # neighboring sector picks up heat too, but slower
        ramp = min(elapsed * 0.05, 12.0)

    temp = sec["base_temp"] + daily + noise + ramp
    depth = round(random.uniform(1.0, 8.0), 1)

    return {
        "sector_id": sec["id"],
        "sector_name": sec["name"],
        "temperature_celsius": round(temp, 2),
        "depth_meters": depth,
        "latitude": sec["lat"] + random.gauss(0, 0.0001),
        "longitude": sec["lon"] + random.gauss(0, 0.0001),
        "timestamp": time.time(),
    }


def create_thermal_stream(input_rate=2.0):
    """spin up a simulated thermal sensor feed using pathway's demo module.
    
    we call _gen_thermal for each row index, which cycles through sectors
    and gradually increases sector 4's temperature. returns a pw.Table
    that the risk engine can consume downstream.
    """
    # NOTE: each lambda gets called independently per column, so we end up
    # calling _gen_thermal multiple times per row. not ideal but pathway's
    # demo module works this way. could cache with a dict if perf matters.
    fns = {
        "sector_id":            lambda i: _gen_thermal(i)["sector_id"],
        "sector_name":          lambda i: _gen_thermal(i)["sector_name"],
        "temperature_celsius":  lambda i: _gen_thermal(i)["temperature_celsius"],
        "depth_meters":         lambda i: _gen_thermal(i)["depth_meters"],
        "latitude":             lambda i: _gen_thermal(i)["latitude"],
        "longitude":            lambda i: _gen_thermal(i)["longitude"],
        "timestamp":            lambda i: _gen_thermal(i)["timestamp"],
    }

    return pw.demo.generate_custom_stream(
        fns,
        schema=ThermalSensorSchema,
        nb_rows=None,       # run forever
        input_rate=input_rate,
        autocommit_duration_ms=1000,
    )
