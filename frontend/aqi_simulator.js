/**
 * AgniHawk - AQI (Air Quality Index) Simulation
 * Simulates live AQI data for cities and landfill zones.
 * Shows before/after hazard AQI comparison.
 */

window.AQISimulator = class AQISimulator {
    constructor() {
        // Base AQI values for Indian cities (realistic baseline)
        this.cityBaselines = {
            'NEW DELHI': { aqi: 180, pm25: 85, pm10: 150, no2: 45, so2: 15, co: 1.2 },
            'MUMBAI': { aqi: 120, pm25: 55, pm10: 95, no2: 35, so2: 12, co: 0.9 },
            'BANGALORE': { aqi: 80, pm25: 35, pm10: 60, no2: 25, so2: 8, co: 0.6 },
            'CHENNAI': { aqi: 95, pm25: 42, pm10: 72, no2: 28, so2: 10, co: 0.7 },
            'KOLKATA': { aqi: 150, pm25: 70, pm10: 125, no2: 40, so2: 14, co: 1.0 },
            'HYDERABAD': { aqi: 85, pm25: 38, pm10: 65, no2: 22, so2: 9, co: 0.5 },
            'AHMEDABAD': { aqi: 140, pm25: 65, pm10: 110, no2: 38, so2: 13, co: 0.9 },
            'PUNE': { aqi: 75, pm25: 32, pm10: 55, no2: 20, so2: 7, co: 0.5 },
            'JAIPUR': { aqi: 130, pm25: 60, pm10: 105, no2: 35, so2: 12, co: 0.8 },
            'LUCKNOW': { aqi: 170, pm25: 80, pm10: 140, no2: 42, so2: 14, co: 1.1 }
        };

        // Landfill-specific AQI zones (worse than city average)
        this.landfillZones = {
            'NEW DELHI': { name: 'Ghazipur Landfill', normalAqi: 220, lat: 28.6228, lon: 77.3268 },
            'MUMBAI': { name: 'Deonar Dumping Ground', normalAqi: 180, lat: 19.0573, lon: 72.9172 },
            'BANGALORE': { name: 'Mandur Landfill', normalAqi: 130, lat: 13.0100, lon: 77.7200 },
            'CHENNAI': { name: 'Kodungaiyur Landfill', normalAqi: 155, lat: 13.1300, lon: 80.2700 },
            'KOLKATA': { name: 'Dhapa Landfill', normalAqi: 200, lat: 22.5400, lon: 88.4100 },
            'HYDERABAD': { name: 'Jawaharnagar Landfill', normalAqi: 140, lat: 17.4800, lon: 78.6100 },
            'AHMEDABAD': { name: 'Pirana Landfill', normalAqi: 190, lat: 22.9800, lon: 72.5500 },
            'PUNE': { name: 'Uruli Devachi Landfill', normalAqi: 120, lat: 18.4400, lon: 73.9800 },
            'JAIPUR': { name: 'Langadiyawas Landfill', normalAqi: 175, lat: 26.8200, lon: 75.7600 },
            'LUCKNOW': { name: 'Semra Landfill', normalAqi: 210, lat: 26.8900, lon: 80.9800 }
        };
    }

    /**
     * Get AQI data for a city — includes city-wide and landfill-specific readings.
     * @param {string} cityName - Name of the city
     * @param {string} riskLevel - Current fire risk level (affects landfill AQI)
     * @param {number} riskScore - Current fire risk score (0-100)
     * @returns {object} AQI data object
     */
    getAQI(cityName, riskLevel = 'GREEN', riskScore = 0) {
        const baseline = this.cityBaselines[cityName];
        const landfill = this.landfillZones[cityName];
        if (!baseline || !landfill) return null;

        // Add natural noise to city AQI
        const noise = () => (Math.random() - 0.5) * 10;
        const cityAqi = Math.round(baseline.aqi + noise());

        // Landfill AQI — BEFORE hazard (normal)
        const landfillNormalAqi = Math.round(landfill.normalAqi + noise());

        // Landfill AQI — DURING/AFTER hazard (dramatically worse)
        let hazardMultiplier = 1.0;
        if (riskLevel === 'BLACK') hazardMultiplier = 3.5;
        else if (riskLevel === 'RED') hazardMultiplier = 2.5;
        else if (riskLevel === 'ORANGE') hazardMultiplier = 1.8;
        else if (riskLevel === 'YELLOW') hazardMultiplier = 1.3;

        const landfillHazardAqi = Math.round(landfill.normalAqi * hazardMultiplier + noise());

        return {
            city: {
                name: cityName,
                aqi: cityAqi,
                category: this.getCategory(cityAqi),
                color: this.getColor(cityAqi),
                pm25: Math.round(baseline.pm25 + noise()),
                pm10: Math.round(baseline.pm10 + noise()),
            },
            landfill: {
                name: landfill.name,
                lat: landfill.lat,
                lon: landfill.lon,
                normalAqi: landfillNormalAqi,
                normalCategory: this.getCategory(landfillNormalAqi),
                normalColor: this.getColor(landfillNormalAqi),
                hazardAqi: landfillHazardAqi,
                hazardCategory: this.getCategory(landfillHazardAqi),
                hazardColor: this.getColor(landfillHazardAqi),
                isHazardActive: riskLevel === 'RED' || riskLevel === 'BLACK' || riskLevel === 'ORANGE',
            },
            riskLevel: riskLevel,
        };
    }

    getCategory(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }

    getColor(aqi) {
        if (aqi <= 50) return '#00e400';
        if (aqi <= 100) return '#ffff00';
        if (aqi <= 150) return '#ff7e00';
        if (aqi <= 200) return '#ff0000';
        if (aqi <= 300) return '#8f3f97';
        return '#7e0023';
    }
};
