// ============================================
//  CesiumJS Tactical Globe — Main Application
// ============================================

// ============================================
//  INDIAN CITIES DATA
// ============================================
const INDIAN_CITIES = [
  {
    name: 'NEW DELHI',
    lat: 28.6139,
    lon: 77.2090,
    population: '32.9M',
    state: 'Delhi NCR',
    description: 'National Capital Territory — Command Center Alpha',
    threat: 'LOW',
    elevation: '216m'
  },
  {
    name: 'MUMBAI',
    lat: 19.0760,
    lon: 72.8777,
    population: '21.7M',
    state: 'Maharashtra',
    description: 'Western Naval Command — Financial Hub',
    threat: 'MODERATE',
    elevation: '14m'
  },
  {
    name: 'BANGALORE',
    lat: 12.9716,
    lon: 77.5946,
    population: '13.2M',
    state: 'Karnataka',
    description: 'Southern Tech Command — Cyber Operations Center',
    threat: 'LOW',
    elevation: '920m'
  },
  {
    name: 'CHENNAI',
    lat: 13.0827,
    lon: 80.2707,
    population: '11.5M',
    state: 'Tamil Nadu',
    description: 'Eastern Naval Command — Maritime Surveillance',
    threat: 'LOW',
    elevation: '6m'
  },
  {
    name: 'KOLKATA',
    lat: 22.5726,
    lon: 88.3639,
    population: '15.1M',
    state: 'West Bengal',
    description: 'Eastern Air Command — Strategic Defense Node',
    threat: 'LOW',
    elevation: '9m'
  },
  {
    name: 'HYDERABAD',
    lat: 17.3850,
    lon: 78.4867,
    population: '10.5M',
    state: 'Telangana',
    description: 'Central Intelligence Node — SIGINT Operations',
    threat: 'LOW',
    elevation: '542m'
  },
  {
    name: 'AHMEDABAD',
    lat: 23.0225,
    lon: 72.5714,
    population: '8.6M',
    state: 'Gujarat',
    description: 'Western Logistics Hub — Supply Chain Command',
    threat: 'LOW',
    elevation: '53m'
  },
  {
    name: 'PUNE',
    lat: 18.5204,
    lon: 73.8567,
    population: '7.8M',
    state: 'Maharashtra',
    description: 'Southern Command HQ — Training Center',
    threat: 'LOW',
    elevation: '560m'
  },
  {
    name: 'JAIPUR',
    lat: 26.9124,
    lon: 75.7873,
    population: '4.1M',
    state: 'Rajasthan',
    description: 'South Western Command — Desert Ops',
    threat: 'LOW',
    elevation: '431m'
  },
  {
    name: 'LUCKNOW',
    lat: 26.8467,
    lon: 80.9462,
    population: '3.7M',
    state: 'Uttar Pradesh',
    description: 'Central Command — Northern Strategic Reserve',
    threat: 'LOW',
    elevation: '123m'
  }
];

// ============================================
//  INITIALIZE CESIUM VIEWER (No Ion Token!)
// ============================================

// Use CartoDB dark tiles — CORS-safe, dark theme, no token required
const darkTileProvider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  credit: 'CartoDB',
  maximumLevel: 18
});

const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  animation: false,
  fullscreenButton: false,
  navigationHelpButton: false,
  creditContainer: document.createElement('div'),
  baseLayer: new Cesium.ImageryLayer(darkTileProvider),
  terrainProvider: new Cesium.EllipsoidTerrainProvider()
});

// Make globe look tactical
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0e17');
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0e17');
viewer.scene.globe.enableLighting = false;
viewer.scene.fog.enabled = true;
viewer.scene.fog.density = 0.0002;
viewer.scene.globe.showGroundAtmosphere = false;
try { viewer.scene.skyAtmosphere.show = false; } catch (e) { }
try { viewer.scene.sun.show = false; } catch (e) { }
try { viewer.scene.moon.show = false; } catch (e) { }
try { viewer.scene.skyBox.show = false; } catch (e) { }

// ============================================
//  CITY ENTITIES
// ============================================
const cityEntities = [];

INDIAN_CITIES.forEach((city) => {
  // Main point marker
  const entity = viewer.entities.add({
    name: city.name,
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString('#00ffd5'),
      outlineColor: Cesium.Color.fromCssColorString('#00ffd580'),
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    label: {
      text: city.name,
      font: '11px Share Tech Mono, monospace',
      fillColor: Cesium.Color.fromCssColorString('#00ffd5'),
      outlineColor: Cesium.Color.fromCssColorString('#0a0e17'),
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -16),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 5e6, 0.4)
    },
    properties: city
  });

  // Pulsing ring around city
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
    ellipse: {
      semiMajorAxis: 18000,
      semiMinorAxis: 18000,
      material: Cesium.Color.fromCssColorString('#00ffd5').withAlpha(0.08),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#00ffd540'),
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  city._entity = entity;
  cityEntities.push(entity);
});

// ============================================
//  GRID OVERLAY ENTITY
// ============================================
let gridEntity = null;

function createGridOverlay() {
  const lines = [];
  // Latitude lines
  for (let lat = -80; lat <= 80; lat += 10) {
    const positions = [];
    for (let lon = -180; lon <= 180; lon += 5) {
      positions.push(lon, lat);
    }
    lines.push(positions);
  }
  // Longitude lines
  for (let lon = -180; lon <= 180; lon += 10) {
    const positions = [];
    for (let lat = -80; lat <= 80; lat += 5) {
      positions.push(lon, lat);
    }
    lines.push(positions);
  }

  const entities = [];
  lines.forEach(coords => {
    const cartesianPositions = Cesium.Cartesian3.fromDegreesArray(coords);
    entities.push(viewer.entities.add({
      polyline: {
        positions: cartesianPositions,
        width: 0.5,
        material: Cesium.Color.fromCssColorString('#00ffd5').withAlpha(0.06),
        clampToGround: true
      },
      _isGrid: true
    }));
  });
  return entities;
}

let gridEntities = [];

// ============================================
//  FLY TO CITY ANIMATION
// ============================================
function flyToCity(city) {
  const popup = document.getElementById('city-popup');

  // Update popup content
  document.getElementById('popup-city-name').textContent = city.name;
  document.getElementById('popup-state').textContent = city.state;
  document.getElementById('popup-description').textContent = city.description;
  document.getElementById('popup-population').textContent = city.population;
  document.getElementById('popup-lat').textContent = city.lat.toFixed(4) + '°N';
  document.getElementById('popup-lon').textContent = city.lon.toFixed(4) + '°E';
  document.getElementById('popup-elevation').textContent = city.elevation;
  document.getElementById('popup-threat').textContent = city.threat;

  const threatEl = document.getElementById('popup-threat');
  threatEl.className = 'popup-value highlight';
  if (city.threat === 'MODERATE') {
    threatEl.style.color = '#ffb800';
    threatEl.style.textShadow = '0 0 6px rgba(255, 184, 0, 0.3)';
  } else {
    threatEl.style.color = '';
    threatEl.style.textShadow = '';
  }

  // Update locations panel
  document.getElementById('loc-city').textContent = city.name;
  document.getElementById('loc-landmark').textContent = city.description;
  document.getElementById('locations-panel').classList.add('visible');

  // Update tactical designation overlay
  document.getElementById('tac-designation').textContent =
    'KH11-' + (Math.floor(Math.random() * 9000) + 1000) + ' OPS-' + (Math.floor(Math.random() * 9000) + 1000);

  // Fly camera — low altitude, steep pitch for satellite recon view
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(city.lon, city.lat - 0.02, 5000),
    orientation: {
      heading: Cesium.Math.toRadians(15),
      pitch: Cesium.Math.toRadians(-70),
      roll: 0.0
    },
    duration: 3.0,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    complete: () => {
      popup.classList.add('visible');
      // Activate vignette for recon view
      document.getElementById('vignette-overlay').classList.add('active');
    }
  });
}

// ============================================
//  CLICK HANDLER
// ============================================
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

handler.setInputAction((click) => {
  const picked = viewer.scene.pick(click.position);
  if (Cesium.defined(picked) && picked.id) {
    const entity = picked.id;
    // Check if it's a city entity
    const city = INDIAN_CITIES.find(c => c._entity === entity);
    if (city) {
      flyToCity(city);
    }
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ============================================
//  CLOSE POPUP
// ============================================
document.getElementById('popup-close').addEventListener('click', () => {
  document.getElementById('city-popup').classList.remove('visible');
  document.getElementById('vignette-overlay').classList.remove('active');
  document.getElementById('locations-panel').classList.remove('visible');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('city-popup').classList.remove('visible');
    document.getElementById('vignette-overlay').classList.remove('active');
    document.getElementById('locations-panel').classList.remove('visible');
  }
});

// ============================================
//  DATA LAYER TOGGLES
// ============================================
const layerState = {
  terrain: false,
  nightLayer: false,
  cities: true,
  grid: false
};

let cesiumTerrainProvider = null;
let nightImageryLayer = null;

// Cities toggle
document.getElementById('toggle-cities').addEventListener('change', (e) => {
  layerState.cities = e.target.checked;
  cityEntities.forEach(entity => {
    entity.show = layerState.cities;
  });
  updateLayerStatus('cities', layerState.cities);
});

// Terrain toggle (visual only — exaggerates terrain perception)
document.getElementById('toggle-terrain').addEventListener('change', (e) => {
  layerState.terrain = e.target.checked;
  // Without Ion there's no world terrain, so we toggle globe depth test
  viewer.scene.globe.depthTestAgainstTerrain = layerState.terrain;
  updateLayerStatus('terrain', layerState.terrain);
});

// Night imagery toggle — overlay Stamen toner (free, dark, looks like night lights)
document.getElementById('toggle-night').addEventListener('change', (e) => {
  layerState.nightLayer = e.target.checked;
  if (layerState.nightLayer) {
    const nightProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      credit: 'CartoDB Night',
      maximumLevel: 18
    });
    nightImageryLayer = viewer.imageryLayers.addImageryProvider(nightProvider);
    nightImageryLayer.alpha = 0.5;
    nightImageryLayer.brightness = 1.5;
  } else {
    if (nightImageryLayer) {
      viewer.imageryLayers.remove(nightImageryLayer);
      nightImageryLayer = null;
    }
  }
  updateLayerStatus('night', layerState.nightLayer);
});

// Grid toggle
document.getElementById('toggle-grid').addEventListener('change', (e) => {
  layerState.grid = e.target.checked;
  if (layerState.grid) {
    gridEntities = createGridOverlay();
  } else {
    gridEntities.forEach(ent => viewer.entities.remove(ent));
    gridEntities = [];
  }
  updateLayerStatus('grid', layerState.grid);
});

function updateLayerStatus(layerId, active) {
  const item = document.querySelector(`[data-layer="${layerId}"]`);
  if (item) {
    const statusEl = item.querySelector('.layer-status');
    if (statusEl) {
      statusEl.textContent = active ? 'ACTIVE' : 'STANDBY';
      statusEl.style.color = active ? '#00ffd5' : '';
    }
    if (active) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  }
}

// ============================================
//  COORDINATE DISPLAY ON MOUSE MOVE
// ============================================
const coordDisplay = document.getElementById('coord-display');

handler.setInputAction((movement) => {
  const cartesian = viewer.camera.pickEllipsoid(
    movement.endPosition, viewer.scene.globe.ellipsoid
  );
  if (cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
    const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
    coordDisplay.textContent = `LAT ${lat}°  LON ${lon}°`;
  } else {
    coordDisplay.textContent = '';
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// ============================================
//  STATUS BAR CLOCK
// ============================================
function updateClock() {
  const now = new Date();
  const utc = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  document.getElementById('status-clock').textContent = utc;
}

setInterval(updateClock, 1000);
updateClock();

// ============================================
//  INITIAL CAMERA — FOCUS ON INDIA
// ============================================
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 5500000),
  orientation: {
    heading: 0.0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0.0
  }
});

// Mark cities as initially active
updateLayerStatus('cities', true);

// ============================================
//  BOOT SEQUENCE ANIMATION
// ============================================
(function bootSequence() {
  const header = document.getElementById('header');
  header.style.opacity = '0';
  const panel = document.getElementById('layers-panel');
  panel.style.opacity = '0';
  panel.style.transform = 'translateX(-20px)';

  setTimeout(() => {
    header.style.transition = 'opacity 0.8s ease';
    header.style.opacity = '1';
  }, 300);

  setTimeout(() => {
    panel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    panel.style.opacity = '1';
    panel.style.transform = 'translateX(0)';
  }, 800);
})();

// ============================================
//  LIGHT / DARK MODE TOGGLE
// ============================================

// Light mode tile provider (Google Maps-style via OpenStreetMap)
const lightTileProvider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  credit: 'OpenStreetMap',
  maximumLevel: 19
});

let lightImageryLayer = null;
let currentDarkLayer = viewer.imageryLayers.get(0); // the CartoDB dark layer

document.getElementById('toggle-theme').addEventListener('change', (e) => {
  const isLight = e.target.checked;

  if (isLight) {
    // Switch to Light Mode
    document.documentElement.classList.add('light-mode');

    // Swap map tiles to light (OSM)
    if (currentDarkLayer) currentDarkLayer.show = false;
    if (!lightImageryLayer) {
      lightImageryLayer = viewer.imageryLayers.addImageryProvider(lightTileProvider);
    } else {
      lightImageryLayer.show = true;
    }

    // Light globe background
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#e8f0fe');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#e8f0fe');

    // Hide scanlines in light mode
    document.getElementById('scanline-overlay').style.display = 'none';

    // Update city marker colors for light mode
    cityEntities.forEach(entity => {
      const city = INDIAN_CITIES.find(c => c._entity === entity);
      if (city && (!city.threat || city.threat === 'LOW' || city.threat === 'GREEN' || city.threat === 'YELLOW')) {
        entity.point.color = Cesium.Color.fromCssColorString('#0891b2');
        entity.point.outlineColor = Cesium.Color.fromCssColorString('#0891b260');
        entity.label.fillColor = Cesium.Color.fromCssColorString('#0f172a');
        entity.label.outlineColor = Cesium.Color.WHITE;
      }
    });

  } else {
    // Switch to Dark Mode
    document.documentElement.classList.remove('light-mode');

    // Swap map tiles back to dark
    if (lightImageryLayer) lightImageryLayer.show = false;
    if (currentDarkLayer) currentDarkLayer.show = true;

    // Dark globe background
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0e17');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0e17');

    // Show scanlines
    document.getElementById('scanline-overlay').style.display = '';

    // Restore dark mode colors
    cityEntities.forEach(entity => {
      const city = INDIAN_CITIES.find(c => c._entity === entity);
      if (city && (!city.threat || city.threat === 'LOW' || city.threat === 'GREEN' || city.threat === 'YELLOW')) {
        entity.point.color = Cesium.Color.fromCssColorString('#00ffd5');
        entity.point.outlineColor = Cesium.Color.fromCssColorString('#00ffd580');
        entity.label.fillColor = Cesium.Color.fromCssColorString('#00ffd5');
        entity.label.outlineColor = Cesium.Color.fromCssColorString('#0a0e17');
      }
    });
  }
});

// ============================================
//  ZOOM CONTROLS
// ============================================
const ZOOM_AMOUNT = 0.4; // fraction of current height

document.getElementById('zoom-in').addEventListener('click', () => {
  const cameraHeight = viewer.camera.positionCartographic.height;
  const zoomDistance = cameraHeight * ZOOM_AMOUNT;
  viewer.camera.zoomIn(zoomDistance);
});

document.getElementById('zoom-out').addEventListener('click', () => {
  const cameraHeight = viewer.camera.positionCartographic.height;
  const zoomDistance = cameraHeight * ZOOM_AMOUNT;
  viewer.camera.zoomOut(zoomDistance);
});

document.getElementById('zoom-reset').addEventListener('click', () => {
  // Close popups and overlays
  document.getElementById('city-popup').classList.remove('visible');
  document.getElementById('vignette-overlay').classList.remove('active');
  document.getElementById('locations-panel').classList.remove('visible');

  // Fly back to India overview
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 5500000),
    orientation: {
      heading: 0.0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0
    },
    duration: 2.0,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  });
});

// Keyboard zoom shortcuts (+ / -)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const cameraHeight = viewer.camera.positionCartographic.height;
  if (e.key === '+' || e.key === '=') {
    viewer.camera.zoomIn(cameraHeight * ZOOM_AMOUNT);
  } else if (e.key === '-' || e.key === '_') {
    viewer.camera.zoomOut(cameraHeight * ZOOM_AMOUNT);
  }
});


// ============================================
//  REAL PATHWAY BACKEND STREAM INTEGRATION
// ============================================

const alertsPanel = document.getElementById('alerts-panel');
setTimeout(() => {
  alertsPanel.classList.add('visible');
}, 1200);

// Connection status element (reuse SAT LINK in footer)
const satLinkEl = document.querySelector('#status-bar .status-item:last-child .status-value');
const networkEl = document.querySelectorAll('#status-bar .status-item .status-value')[2]; // NETWORK

function updateConnectionUI(status) {
  switch (status) {
    case 'connected':
      if (satLinkEl) { satLinkEl.textContent = 'PATHWAY LIVE'; satLinkEl.style.color = '#00ffd5'; }
      if (networkEl) { networkEl.textContent = 'STREAM ACTIVE'; networkEl.style.color = '#00ffd5'; }
      // Update the PIPELINE indicator in the header
      document.getElementById('pipeline-status').style.background = '#00ffd5';
      break;
    case 'connecting':
      if (satLinkEl) { satLinkEl.textContent = 'CONNECTING...'; satLinkEl.style.color = '#ffb800'; }
      if (networkEl) { networkEl.textContent = 'INIT'; networkEl.style.color = '#ffb800'; }
      document.getElementById('pipeline-status').style.background = '#ffb800';
      break;
    case 'reconnecting':
      if (satLinkEl) { satLinkEl.textContent = 'RECONNECTING...'; satLinkEl.style.color = '#ff3c3c'; }
      if (networkEl) { networkEl.textContent = 'RETRY'; networkEl.style.color = '#ff3c3c'; }
      document.getElementById('pipeline-status').style.background = '#ff3c3c';
      break;
    case 'disconnected':
      if (satLinkEl) { satLinkEl.textContent = 'OFFLINE'; satLinkEl.style.color = '#ff3c3c'; }
      if (networkEl) { networkEl.textContent = 'OFFLINE'; networkEl.style.color = '#ff3c3c'; }
      document.getElementById('pipeline-status').style.background = '#ff3c3c';
      break;
  }
}

const pathwayStream = new window.PathwayStream((data) => {
  // Update cities on the map with real Pathway data
  data.sectors.forEach(sector => {
    const city = INDIAN_CITIES.find(c => c.name === sector.sector_name);
    if (city && city._entity) {
      // Update threat property
      city.threat = sector.risk_level;

      // Visual changes based on risk
      if (sector.risk_level === 'BLACK') {
        city._entity.point.color = Cesium.Color.fromCssColorString('#ff0000');
        city._entity.point.pixelSize = 16;
        city._entity.label.fillColor = Cesium.Color.fromCssColorString('#ff0000');
      } else if (sector.risk_level === 'RED') {
        city._entity.point.color = Cesium.Color.fromCssColorString('#ff3c3c');
        city._entity.point.pixelSize = 14;
        city._entity.label.fillColor = Cesium.Color.fromCssColorString('#ff3c3c');
      } else if (sector.risk_level === 'ORANGE') {
        city._entity.point.color = Cesium.Color.fromCssColorString('#ffb800');
        city._entity.point.pixelSize = 12;
        city._entity.label.fillColor = Cesium.Color.fromCssColorString('#ffb800');
      } else {
        city._entity.point.color = Cesium.Color.fromCssColorString('#00ffd5');
        city._entity.point.pixelSize = 12;
        city._entity.label.fillColor = Cesium.Color.fromCssColorString('#00ffd5');
      }

      // Store live metrics for the popup
      city.temperature = sector.temperature_celsius;
      city.methane = sector.methane_ppm;
      city.carbon_monoxide = sector.carbon_monoxide_ppm;
      city.riskScore = sector.fire_risk_score;
      city.eta = sector.estimated_minutes_to_combustion;

      // Update active popup if open
      const activePopupName = document.getElementById('popup-city-name').textContent;
      if (activePopupName === city.name) {
        document.getElementById('popup-threat').textContent = `[${city.riskScore.toFixed(0)}] ${city.threat}`;

        const threatEl = document.getElementById('popup-threat');
        if (city.threat === 'MODERATE' || city.threat === 'ORANGE') {
          threatEl.style.color = '#ffb800';
          threatEl.style.textShadow = '0 0 6px rgba(255, 184, 0, 0.3)';
        } else if (city.threat === 'RED' || city.threat === 'BLACK') {
          threatEl.style.color = '#ff3c3c';
          threatEl.style.textShadow = '0 0 6px rgba(255, 60, 60, 0.3)';
        } else {
          threatEl.style.color = 'var(--cyan)';
          threatEl.style.textShadow = 'var(--cyan-glow)';
        }
      }
    }
  });

  // Update alerts feed
  const feed = document.getElementById('alerts-feed');
  if (data.alerts.length > 0) {
    const emptyMsg = feed.querySelector('.alert-empty');
    if (emptyMsg) {
      feed.removeChild(emptyMsg);
    }

    // Add new alerts (with LLM narratives from backend)
    [...data.alerts].reverse().forEach(alert => {
      const card = document.createElement('div');
      card.className = `alert-card ${alert.risk_level === 'ORANGE' ? 'orange' : ''}`;

      const timeStr = new Date(alert.alert_time * 1000).toLocaleTimeString();
      card.innerHTML = `
        <div style="color: ${alert.risk_level === 'ORANGE' ? 'var(--amber)' : 'var(--red)'}; margin-bottom: 6px; font-weight: bold; letter-spacing: 1px;">
          [${timeStr}] ${alert.sector_name} - RISK: ${alert.fire_risk_score.toFixed(0)}
        </div>
        <div>${alert.narrative}</div>
      `;
      feed.prepend(card);

      // Fetch LLM narrative from backend (async enhancement)
      if (pathwayStream.isConnected) {
        pathwayStream.fetchNarrative(alert.sector_id).then(narrative => {
          if (narrative) {
            card.querySelector('div:last-child').textContent = narrative;
          }
        });
      }
    });

    // Keep max 10 alerts
    while (feed.children.length > 10) {
      feed.removeChild(feed.lastChild);
    }
  }
}, {
  baseUrl: 'http://localhost:5000',
  onStatusChange: updateConnectionUI,
});

// Start the real Pathway stream connection
setTimeout(() => {
  pathwayStream.start();
}, 2000);


// ============================================
//  AQI LAYER
// ============================================
const aqiSim = new window.AQISimulator();
let aqiEnabled = false;
let aqiEntities = [];
let selectedCityForAqi = 'NEW DELHI'; // Default

document.getElementById('toggle-aqi').addEventListener('change', (e) => {
  aqiEnabled = e.target.checked;
  updateLayerStatus('aqi', aqiEnabled);

  if (aqiEnabled) {
    document.getElementById('aqi-panel').classList.add('visible');
    updateAqiDisplay(selectedCityForAqi);
    drawAqiZones();
  } else {
    document.getElementById('aqi-panel').classList.remove('visible');
    aqiEntities.forEach(ent => viewer.entities.remove(ent));
    aqiEntities = [];
  }
});

document.getElementById('aqi-close').addEventListener('click', () => {
  document.getElementById('aqi-panel').classList.remove('visible');
  document.getElementById('toggle-aqi').checked = false;
  aqiEnabled = false;
  updateLayerStatus('aqi', false);
  aqiEntities.forEach(ent => viewer.entities.remove(ent));
  aqiEntities = [];
});

function updateAqiDisplay(cityName) {
  const city = INDIAN_CITIES.find(c => c.name === cityName);
  const riskLevel = city ? (city.threat || 'GREEN') : 'GREEN';
  const riskScore = city ? (city.riskScore || 0) : 0;

  const aqiData = aqiSim.getAQI(cityName, riskLevel, riskScore);
  if (!aqiData) return;

  const cityValEl = document.getElementById('aqi-city-value');
  cityValEl.textContent = aqiData.city.aqi;
  cityValEl.style.color = aqiData.city.color;

  document.getElementById('aqi-city-category').textContent = aqiData.city.category;
  document.getElementById('aqi-city-category').style.color = aqiData.city.color;
  document.getElementById('aqi-pm25').textContent = aqiData.city.pm25 + ' μg/m³';
  document.getElementById('aqi-pm10').textContent = aqiData.city.pm10 + ' μg/m³';

  document.getElementById('aqi-landfill-name').textContent = aqiData.landfill.name;

  const beforeEl = document.getElementById('aqi-before');
  beforeEl.textContent = aqiData.landfill.normalAqi;
  beforeEl.style.color = aqiData.landfill.normalColor;
  document.getElementById('aqi-before-cat').textContent = aqiData.landfill.normalCategory;

  const afterEl = document.getElementById('aqi-after');
  afterEl.textContent = aqiData.landfill.hazardAqi;
  afterEl.style.color = aqiData.landfill.hazardColor;
  document.getElementById('aqi-after-cat').textContent = aqiData.landfill.hazardCategory;
}

function drawAqiZones() {
  aqiEntities.forEach(ent => viewer.entities.remove(ent));
  aqiEntities = [];

  Object.entries(aqiSim.landfillZones).forEach(([cityName, lf]) => {
    const city = INDIAN_CITIES.find(c => c.name === cityName);
    const riskLevel = city ? (city.threat || 'GREEN') : 'GREEN';
    const aqiData = aqiSim.getAQI(cityName, riskLevel, 0);
    if (!aqiData) return;

    const currentAqi = aqiData.landfill.isHazardActive ? aqiData.landfill.hazardAqi : aqiData.landfill.normalAqi;
    const color = aqiData.landfill.isHazardActive ? aqiData.landfill.hazardColor : aqiData.landfill.normalColor;

    const zone = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lf.lon, lf.lat),
      ellipse: {
        semiMajorAxis: 2500,
        semiMinorAxis: 2500,
        material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.6),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: `AQI: ${currentAqi}`,
        font: '10px Share Tech Mono, monospace',
        fillColor: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 5e6, 0.3)
      },
      _isAqi: true
    });
    aqiEntities.push(zone);
  });
}

// Update AQI when a city is clicked
const _originalFlyToCity = flyToCity;
flyToCity = function (city) {
  _originalFlyToCity(city);
  selectedCityForAqi = city.name;
  if (aqiEnabled) {
    updateAqiDisplay(city.name);
  }
};

// Periodically refresh AQI data
setInterval(() => {
  if (aqiEnabled) {
    updateAqiDisplay(selectedCityForAqi);
    drawAqiZones();
  }
}, 3000);


// ============================================
//  3D BUILDINGS (OSM Buildings via Cesium Ion)
// ============================================
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ZGJlODA1Ni0yNWI0LTQ3YWQtOTNjNi1hOWYwZjQyYjY1NzMiLCJpZCI6Mzk0OTI4LCJpYXQiOjE3NzIxMjE1NTN9.qvDUd9NZuOOz3en34Z9n1iK_hI2XU6M0uyDnVFJddLg';

let buildings3dTileset = null;

document.getElementById('toggle-3d-buildings').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  updateLayerStatus('buildings3d', enabled);

  if (enabled) {
    if (!buildings3dTileset) {
      try {
        buildings3dTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildings3dTileset);

        // Style the buildings based on the tactical theme
        buildings3dTileset.style = new Cesium.Cesium3DTileStyle({
          color: {
            conditions: [
              ['true', "color('rgba(100, 180, 220, 0.7)')"]
            ]
          }
        });

        console.log('[3D] OSM Buildings loaded successfully via Ion Token');
      } catch (err) {
        console.warn('[3D] Could not load OSM Buildings:', err.message);
        alert('Failed to load 3D buildings. The Ion token might be invalid.');
      }
    } else {
      buildings3dTileset.show = true;
    }

    // Tilt the camera to show the 3D effect
    const currentPos = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(currentPos.longitude, currentPos.latitude, 800),
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(-20), // Tilt up to see skyline
        roll: 0.0
      },
      duration: 2.0
    });

  } else {
    if (buildings3dTileset) {
      buildings3dTileset.show = false;
    }

    // Smooth transition back to top-down
    const currentPos = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(currentPos.longitude, currentPos.latitude, Math.max(currentPos.height, 5000)),
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(-90), // Top down
        roll: 0.0
      },
      duration: 2.0
    });
  }
});


// ============================================
//  SAFE ROUTE GUIDANCE
// ============================================
let safeRouteGuide = null;
let safeRouteEnabled = false;

document.getElementById('toggle-safe-route').addEventListener('change', async (e) => {
  safeRouteEnabled = e.target.checked;
  updateLayerStatus('saferoute', safeRouteEnabled);

  if (safeRouteEnabled) {
    safeRouteGuide = new window.SafeRouteGuide(viewer);

    // Get user location
    await safeRouteGuide.getUserLocation();

    // Add hazard zones around all landfills with active hazards
    Object.entries(aqiSim.landfillZones).forEach(([cityName, lf]) => {
      const city = INDIAN_CITIES.find(c => c.name === cityName);
      const riskLevel = city ? (city.threat || 'GREEN') : 'GREEN';

      if (riskLevel === 'RED' || riskLevel === 'BLACK' || riskLevel === 'ORANGE') {
        const radius = riskLevel === 'BLACK' ? 5000 : riskLevel === 'RED' ? 3000 : 2000;
        safeRouteGuide.addHazardZone(lf.lat, lf.lon, radius, lf.name, riskLevel);
      }
    });

    // Find the nearest hazardous city and draw a safe route to a safe point
    if (safeRouteGuide.userLocation) {
      const userLat = safeRouteGuide.userLocation.lat;
      const userLon = safeRouteGuide.userLocation.lon;

      // Find nearest hazard zone
      let nearestHazard = null;
      let minDist = Infinity;
      Object.entries(aqiSim.landfillZones).forEach(([cityName, lf]) => {
        const city = INDIAN_CITIES.find(c => c.name === cityName);
        const riskLevel = city ? (city.threat || 'GREEN') : 'GREEN';
        if (riskLevel === 'RED' || riskLevel === 'BLACK') {
          const dist = safeRouteGuide._distanceBetween(userLat, userLon, lf.lat, lf.lon);
          if (dist < minDist) {
            minDist = dist;
            nearestHazard = { lat: lf.lat, lon: lf.lon, name: lf.name };
          }
        }
      });

      if (nearestHazard) {
        // Draw route to a safe assembly point (offset from hazard)
        const safeLat = nearestHazard.lat + 0.03;
        const safeLon = nearestHazard.lon - 0.03;
        const routeData = safeRouteGuide.drawSafeRoute(safeLat, safeLon, 'SAFE ASSEMBLY POINT', nearestHazard.lat, nearestHazard.lon);
        window.activeNavigationRoute = routeData.safe;

        // Populate Navigation Panel
        if (routeData && routeData.navigation) {
          document.getElementById('nav-distance').textContent = `${routeData.navigation.distanceKm} km`;
          document.getElementById('nav-eta').textContent = `${routeData.navigation.etaMinutes} min`;

          const stepsList = document.getElementById('nav-steps-list');
          stepsList.innerHTML = '';

          routeData.navigation.steps.forEach(step => {
            const li = document.createElement('li');
            li.className = 'nav-step';
            li.innerHTML = `
              <div class="nav-step-icon">${step.icon}</div>
              <div class="nav-step-text">
                ${step.text}
                <div class="nav-step-dist">${step.dist}</div>
              </div>
            `;
            stepsList.appendChild(li);
          });

          document.getElementById('nav-panel').classList.add('visible');
          document.getElementById('nav-start-btn').textContent = 'START NAVIGATION';
          document.getElementById('nav-start-btn').style.background = '';
          document.getElementById('nav-start-btn').style.boxShadow = '';
          document.querySelector('.nav-status').textContent = 'Safe Route Generated';
          document.querySelector('.nav-status').style.color = '';
        }

        // Fly to show the route
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(userLon, userLat, 10000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-65),
            roll: 0.0
          },
          duration: 2.5
        });
      }
    }
  } else {
    document.getElementById('nav-panel').classList.remove('visible');
    if (safeRouteGuide) {
      safeRouteGuide.clearAll();
      safeRouteGuide = null;
    }
    window.activeNavigationRoute = null;
  }
});

// Close button for Nav Panel
document.getElementById('nav-close').addEventListener('click', () => {
  document.getElementById('nav-panel').classList.remove('visible');
  document.getElementById('toggle-safe-route').checked = false;
  safeRouteEnabled = false;
  updateLayerStatus('saferoute', false);
  if (safeRouteGuide) {
    safeRouteGuide.clearAll();
    safeRouteGuide = null;
  }
  window.activeNavigationRoute = null;
});

// Start Navigation Button
document.getElementById('nav-start-btn').addEventListener('click', () => {
  if (!window.activeNavigationRoute || !safeRouteGuide || !safeRouteGuide.userLocation) return;

  const btn = document.getElementById('nav-start-btn');
  if (btn.textContent === 'NAVIGATING...') return;

  btn.textContent = 'NAVIGATING...';
  btn.style.background = '#00c853';
  btn.style.boxShadow = '0 0 20px rgba(0, 230, 118, 0.6)';

  document.querySelector('.nav-status').textContent = '🔴 LIVE TRACKING ACTIVE';
  document.querySelector('.nav-status').style.color = '#00ffd5';

  const userLat = safeRouteGuide.userLocation.lat;
  const userLon = safeRouteGuide.userLocation.lon;
  const destLon = window.activeNavigationRoute[window.activeNavigationRoute.length - 1][0];
  const destLat = window.activeNavigationRoute[window.activeNavigationRoute.length - 1][1];

  // Calculate rough bearing to destination
  const dy = destLat - userLat;
  const dx = Math.cos(Math.PI / 180 * userLat) * (destLon - userLon);
  let heading = Math.atan2(dx, dy);

  // Fly camera to a 3D driving perspective (behind user, looking forward)
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      userLon - (Math.sin(heading) * 0.005),
      userLat - (Math.cos(heading) * 0.005),
      200 // 200m altitude
    ),
    orientation: {
      heading: heading,
      pitch: Cesium.Math.toRadians(-15), // Looking slightly down
      roll: 0.0
    },
    duration: 3.0
  });
});
