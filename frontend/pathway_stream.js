/**
 * pathway backend connector
 * 
 * hooks into the flask SSE endpoint at :5000/api/stream
 * auto-reconnects if the backend goes down
 * replaces the old mock data generator
 */

window.PathwayStream = class PathwayStream {
    constructor(callback, opts = {}) {
        this.callback = callback;
        this.base = opts.baseUrl || 'http://localhost:5000';
        this.isConnected = false;
        this._es = null;          // EventSource handle
        this._retryTimer = null;
        this._retries = 0;
        this._retryMs = 5000;     // try again every 5s
        this._onStatus = opts.onStatusChange || (() => { });
    }

    start() {
        console.log(`[pathway] connecting to ${this.base}/api/stream...`);
        this._onStatus('connecting');
        this._connect();
    }

    stop() {
        if (this._es) { this._es.close(); this._es = null; }
        if (this._retryTimer) { clearInterval(this._retryTimer); this._retryTimer = null; }
        this.isConnected = false;
        this._onStatus('disconnected');
        console.log('[pathway] disconnected');
    }

    _connect() {
        try {
            this._es = new EventSource(`${this.base}/api/stream`);

            this._es.onopen = () => {
                console.log('[pathway] ✅ connected!');
                this.isConnected = true;
                this._retries = 0;
                this._onStatus('connected');
                // kill retry loop if it was running
                if (this._retryTimer) {
                    clearInterval(this._retryTimer);
                    this._retryTimer = null;
                }
            };

            this._es.onmessage = (evt) => {
                try {
                    const raw = JSON.parse(evt.data);
                    this._process(raw);
                } catch (e) {
                    console.warn('[pathway] bad SSE data:', e);
                }
            };

            this._es.onerror = () => {
                // backend probably went down
                console.warn('[pathway] connection lost, will retry...');
                this.isConnected = false;
                this._es.close();
                this._es = null;
                this._onStatus('reconnecting');
                this._scheduleRetry();
            };

        } catch (e) {
            console.warn('[pathway] EventSource failed:', e);
            this._onStatus('reconnecting');
            this._scheduleRetry();
        }
    }

    _scheduleRetry() {
        if (this._retryTimer) return;  // already retrying
        this._retryTimer = setInterval(() => {
            this._retries++;
            console.log(`[pathway] retry #${this._retries}...`);
            this._onStatus('reconnecting');
            this._connect();
        }, this._retryMs);
    }

    // transform backend data to match what the frontend expects
    _process(data) {
        const out = {
            sectors: (data.sectors || []).map(s => ({
                sector_id: s.sector_id,
                sector_name: s.sector_name,
                fire_risk_score: s.fire_risk_score,
                risk_level: s.risk_level,
                temperature_celsius: s.temperature_celsius,
                methane_ppm: s.methane_ppm,
                carbon_monoxide_ppm: s.carbon_monoxide_ppm,
                wind_speed_kmh: s.wind_speed_kmh || 0,
                humidity_pct: s.humidity_pct || 0,
                estimated_minutes_to_combustion: s.estimated_minutes_to_combustion,
                latitude: s.latitude,
                longitude: s.longitude,
                timestamp: s.timestamp,
            })),
            alerts: (data.alerts || []).map(a => ({
                sector_id: a.sector_id,
                sector_name: a.sector_name,
                risk_level: a.risk_level,
                fire_risk_score: a.fire_risk_score,
                narrative: a.alert_message || a.narrative || '',
                alert_time: a.alert_time || a.timestamp,
            })),
            weather: data.weather || {},
            timestamp: data.timestamp || Date.now() / 1000,
        };
        this.callback(out);
    }

    // grab LLM narrative from the backend for a specific sector
    async fetchNarrative(sectorId) {
        try {
            const r = await fetch(`${this.base}/api/narrative/${sectorId}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            return d.narrative || 'narrative unavailable';
        } catch (e) {
            console.warn(`[pathway] narrative failed for sector ${sectorId}:`, e);
            return null;
        }
    }

    // check backend health
    async fetchHealth() {
        try {
            const r = await fetch(`${this.base}/api/health`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            return { status: 'offline', pipeline: 'unreachable' };
        }
    }
};
