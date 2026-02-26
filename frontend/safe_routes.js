/**
 * AgniHawk - Safe Route Guidance System
 * Gets user location, calculates safe evacuation routes avoiding hazard zones.
 * Uses browser Geolocation API + draws routes on CesiumJS globe.
 */

window.SafeRouteGuide = class SafeRouteGuide {
    constructor(viewer) {
        this.viewer = viewer;
        this.userLocation = null;
        this.routeEntities = [];
        this.hazardZones = [];
        this.userMarker = null;
    }

    /**
     * Request user's live GPS location
     */
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.userLocation = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                    console.log(`[SafeRoute] User location: ${this.userLocation.lat}, ${this.userLocation.lon}`);
                    this._addUserMarker();
                    resolve(this.userLocation);
                },
                (err) => {
                    console.warn('[SafeRoute] Location denied, using default (Delhi)');
                    // Fallback to Delhi center
                    this.userLocation = { lat: 28.6139, lon: 77.2090, accuracy: 1000 };
                    this._addUserMarker();
                    resolve(this.userLocation);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /**
     * Add a pulsing blue marker for the user's location
     */
    _addUserMarker() {
        if (this.userMarker) {
            this.viewer.entities.remove(this.userMarker);
        }

        this.userMarker = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(this.userLocation.lon, this.userLocation.lat),
            point: {
                pixelSize: 14,
                color: Cesium.Color.fromCssColorString('#4285f4'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 3,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: '📍 YOU',
                font: '12px Inter, sans-serif',
                fillColor: Cesium.Color.fromCssColorString('#4285f4'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
        });

        // Add accuracy circle
        this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(this.userLocation.lon, this.userLocation.lat),
            ellipse: {
                semiMajorAxis: Math.min(this.userLocation.accuracy, 500),
                semiMinorAxis: Math.min(this.userLocation.accuracy, 500),
                material: Cesium.Color.fromCssColorString('#4285f4').withAlpha(0.12),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('#4285f4').withAlpha(0.4),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            _isSafeRoute: true
        });
    }

    /**
     * Add a hazard exclusion zone around a landfill
     */
    addHazardZone(lat, lon, radiusMeters, landfillName, riskLevel) {
        const zoneColor = riskLevel === 'BLACK' ? '#ff000060' :
            riskLevel === 'RED' ? '#ff3c3c40' :
                '#ffb80030';
        const outlineColor = riskLevel === 'BLACK' ? '#ff0000' :
            riskLevel === 'RED' ? '#ff3c3c' :
                '#ffb800';

        const zone = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            ellipse: {
                semiMajorAxis: radiusMeters,
                semiMinorAxis: radiusMeters,
                material: Cesium.Color.fromCssColorString(zoneColor),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString(outlineColor),
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: `⚠ HAZARD ZONE\n${landfillName}`,
                font: '11px Share Tech Mono, monospace',
                fillColor: Cesium.Color.fromCssColorString(outlineColor),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 1e6, 0.3)
            },
            _isHazardZone: true
        });

        this.hazardZones.push({ entity: zone, lat, lon, radius: radiusMeters, name: landfillName });
        return zone;
    }

    /**
     * Calculate and draw a safe route from user to a safe destination,
     * avoiding the hazard zone.
     */
    drawSafeRoute(destLat, destLon, destName, hazardLat, hazardLon) {
        // Clear previous routes
        this.routeEntities.forEach(e => this.viewer.entities.remove(e));
        this.routeEntities = [];

        if (!this.userLocation) return;

        const userLat = this.userLocation.lat;
        const userLon = this.userLocation.lon;

        // Calculate a safe waypoint that goes AROUND the hazard zone
        const midLat = (userLat + destLat) / 2;
        const midLon = (userLon + destLon) / 2;

        // Check if the direct path goes through the hazard
        const distToHazard = this._distanceBetween(midLat, midLon, hazardLat, hazardLon);

        let waypoints;
        if (distToHazard < 3000) {
            // Route goes near hazard — divert!
            const offsetLat = hazardLat + (hazardLat - midLat) * 0.5;
            const offsetLon = hazardLon + (hazardLon - midLon) * 0.5;
            waypoints = [
                [userLon, userLat],
                [offsetLon, offsetLat],
                [destLon, destLat]
            ];
        } else {
            waypoints = [
                [userLon, userLat],
                [destLon, destLat]
            ];
        }

        // Draw the safe route
        const positions = waypoints.flatMap(w => [w[0], w[1]]);
        const safeRoute = this.viewer.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(positions),
                width: 4,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.fromCssColorString('#00e676')
                }),
                clampToGround: true
            },
            _isSafeRoute: true
        });
        this.routeEntities.push(safeRoute);

        // Draw the DANGEROUS route (crossed out)
        const dangerRoute = this.viewer.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray([
                    userLon, userLat, destLon, destLat
                ]),
                width: 2,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#ff3c3c80'),
                    dashLength: 16
                }),
                clampToGround: true
            },
            _isSafeRoute: true
        });
        this.routeEntities.push(dangerRoute);

        // Add destination marker
        const destMarker = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(destLon, destLat),
            point: {
                pixelSize: 10,
                color: Cesium.Color.fromCssColorString('#00e676'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
                text: `🏥 ${destName}`,
                font: '11px Inter, sans-serif',
                fillColor: Cesium.Color.fromCssColorString('#00e676'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -14),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            _isSafeRoute: true
        });
        this.routeEntities.push(destMarker);

        // Generate Turn-by-Turn Steps
        let totalDist = 0;
        const steps = [];

        // Step 1: Head out
        steps.push({ icon: '📍', text: 'Head towards the designated safe zone.', dist: '0 km' });

        if (distToHazard < 3000) {
            // Calculate segment distances
            const dist1 = this._distanceBetween(userLat, userLon, waypoints[1][1], waypoints[1][0]);
            const dist2 = this._distanceBetween(waypoints[1][1], waypoints[1][0], destLat, destLon);
            totalDist = dist1 + dist2;

            steps.push({
                icon: '⚠️',
                text: `DANGER AHEAD: Hazard zone detected at ${Math.round(dist1 / 1000 * 10) / 10} km. Rerouting...`,
                dist: `${Math.round(dist1 / 100) / 10} km`
            });
            steps.push({
                icon: '↱',
                text: 'Turn to avoid the hazard perimeter. Follow the highlighted green path.',
                dist: `${Math.round(dist2 / 100) / 10} km`
            });
        } else {
            totalDist = this._distanceBetween(userLat, userLon, destLat, destLon);
            steps.push({
                icon: '⬆️',
                text: 'Continue straight on the fastest route.',
                dist: `${Math.round(totalDist / 100) / 10} km`
            });
        }

        steps.push({ icon: '🏥', text: `Arrive at ${destName}. Wait for further instructions.`, dist: '' });

        return {
            safe: waypoints,
            direct: [[userLon, userLat], [destLon, destLat]],
            navigation: {
                distanceKm: Math.round(totalDist / 10) / 100,
                etaMinutes: Math.ceil((totalDist / 1000) * 1.5), // Rough 40km/h estimate in city
                steps: steps
            }
        };
    }

    /**
     * Clear all route and hazard zone entities
     */
    clearAll() {
        this.routeEntities.forEach(e => this.viewer.entities.remove(e));
        this.hazardZones.forEach(h => this.viewer.entities.remove(h.entity));
        if (this.userMarker) this.viewer.entities.remove(this.userMarker);
        this.routeEntities = [];
        this.hazardZones = [];
    }

    _distanceBetween(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
