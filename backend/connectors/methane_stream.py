# methane + CO + CO2 emission stream
# models gas sensors scattered through the waste mass
# methane buildup tracks with temperature (hotter = more decomposition gases)

import pathway as pw
import random, math, time


class MethaneSchema(pw.Schema):
    sector_id: int
    methane_ppm: float
    co2_ppm: float
    carbon_monoxide_ppm: float
    timestamp: float


# baseline gas concentrations per sector
# sector 4 is always highest since it's sitting on the hottest decomposition pocket
BASELINES = {
    1: {"ch4": 350, "co2": 800,  "co": 5},
    2: {"ch4": 320, "co2": 750,  "co": 4},
    3: {"ch4": 400, "co2": 900,  "co": 8},
    4: {"ch4": 450, "co2": 950,  "co": 10},  # hot sector
    5: {"ch4": 300, "co2": 700,  "co": 3},
    6: {"ch4": 280, "co2": 680,  "co": 3},
}


def _gen_methane(idx):
    sid = (idx % 6) + 1
    bl = BASELINES[sid]
    elapsed = idx // 6

    # random fluctuations — sensor noise essentially
    ch4_noise = random.gauss(0, 25)
    co2_noise = random.gauss(0, 40)
    co_noise  = random.gauss(0, 1)

    # sector 4 ramps up alongside temperature
    ch4_ramp, co_ramp = 0.0, 0.0
    if sid == 4:
        ch4_ramp = min(elapsed * 2.0, 500)    # tops out at +500 ppm
        co_ramp  = min(elapsed * 0.5, 80)     # CO is the real fire indicator
    elif sid == 3:
        ch4_ramp = min(elapsed * 0.5, 150)
        co_ramp  = min(elapsed * 0.1, 15)

    # gas pocket releases — these happen IRL and cause sudden spikes
    spike = 0
    if random.random() < 0.03:
        spike = random.uniform(100, 300)

    ch4 = max(0, bl["ch4"] + ch4_noise + ch4_ramp + spike)
    co2 = max(0, bl["co2"] + co2_noise + (ch4_ramp * 0.5))
    co  = max(0, bl["co"] + co_noise + co_ramp)

    return {
        "sector_id": sid,
        "methane_ppm": round(ch4, 1),
        "co2_ppm": round(co2, 1),
        "carbon_monoxide_ppm": round(co, 1),
        "timestamp": time.time(),
    }


def create_methane_stream(input_rate=1.5):
    """pathway demo stream for methane/gas sensor data.
    same pattern as thermals — cycles through sectors, ramps up sector 4."""

    fns = {
        "sector_id":            lambda i: _gen_methane(i)["sector_id"],
        "methane_ppm":          lambda i: _gen_methane(i)["methane_ppm"],
        "co2_ppm":              lambda i: _gen_methane(i)["co2_ppm"],
        "carbon_monoxide_ppm":  lambda i: _gen_methane(i)["carbon_monoxide_ppm"],
        "timestamp":            lambda i: _gen_methane(i)["timestamp"],
    }

    return pw.demo.generate_custom_stream(
        fns,
        schema=MethaneSchema,
        nb_rows=None,
        input_rate=input_rate,
        autocommit_duration_ms=1000,
    )
