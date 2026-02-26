# weather data connector
# tries OpenWeatherMap first, falls back to simulation
# for the hackathon demo we mostly use simulated data since
# the API has rate limits and we want a controlled narrative
# (gradually worsening conditions → fire risk escalation)

import pathway as pw
import os, time, math, random

try:
    import requests
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False


class WeatherSchema(pw.Schema):
    wind_speed_kmh: float
    wind_direction_deg: float
    humidity_pct: float
    temperature_ambient: float
    pressure_hpa: float
    timestamp: float


# ghazipur coords
LAT = 28.6218
LON = 77.3266


def _fetch_live(api_key):
    """hit openweathermap and convert to our schema. returns None on failure."""
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": LAT, "lon": LON, "appid": api_key, "units": "metric"}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        d = r.json()
        return {
            "wind_speed_kmh": round(d["wind"]["speed"] * 3.6, 1),
            "wind_direction_deg": float(d["wind"].get("deg", 0)),
            "humidity_pct": float(d["main"]["humidity"]),
            "temperature_ambient": float(d["main"]["temp"]),
            "pressure_hpa": float(d["main"]["pressure"]),
            "timestamp": time.time(),
        }
    except Exception as e:
        print(f"[weather] API failed: {e}, using simulation")
        return None


def _sim_weather(idx):
    """simulated hot dry windy day in Delhi — worst case scenario for fire risk"""
    t = idx  # just rename for readability

    # temp peaks around midday
    base_temp = 38.0 + 5.0 * math.sin((t - 180) * math.pi / 360)

    # wind picks up in afternoon
    wind = 8.0 + min(t * 0.05, 12.0) + random.gauss(0, 1.5)

    # humidity drops as it gets hotter and windier
    humidity = max(15.0, 45.0 - t * 0.1 + random.gauss(0, 3))

    # wind slowly shifts northeast
    direction = (45.0 + t * 0.2 + random.gauss(0, 5)) % 360

    return {
        "wind_speed_kmh": round(max(0, wind), 1),
        "wind_direction_deg": round(direction, 1),
        "humidity_pct": round(max(10, min(100, humidity)), 1),
        "temperature_ambient": round(base_temp + random.gauss(0, 0.5), 1),
        "pressure_hpa": round(1008 + random.gauss(0, 1), 1),
        "timestamp": time.time(),
    }


def create_weather_stream(input_rate=0.5):
    """weather data via pathway demo stream.
    
    could use the real API but for hackathon purposes the simulation
    gives us a better story — conditions worsen over time leading
    to the fire event in sector 4.
    """
    # TODO: wire up the live API properly once we have a paid key
    # api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")

    fns = {
        "wind_speed_kmh":      lambda i: _sim_weather(i)["wind_speed_kmh"],
        "wind_direction_deg":  lambda i: _sim_weather(i)["wind_direction_deg"],
        "humidity_pct":        lambda i: _sim_weather(i)["humidity_pct"],
        "temperature_ambient": lambda i: _sim_weather(i)["temperature_ambient"],
        "pressure_hpa":        lambda i: _sim_weather(i)["pressure_hpa"],
        "timestamp":           lambda i: _sim_weather(i)["timestamp"],
    }

    return pw.demo.generate_custom_stream(
        fns,
        schema=WeatherSchema,
        nb_rows=None,
        input_rate=input_rate,
        autocommit_duration_ms=2000,
    )
