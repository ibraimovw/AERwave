import { t } from './localization.js';
import { formatTemp } from './weather.js';

const GRID_CACHE_TTL_MS = 10 * 60 * 1000;
const gridCache = new Map();

let mapInstance = null;
let markersLayer = null;
let currentLayer = 'temperature';
let currentCenter = { latitude: 42.8746, longitude: 74.5698, name: 'Bishkek' };
let currentUnit = 'c';
let debounceTimer = null;
let activeController = null;

const LAYER_META = {
  temperature: {
    gradient: 'linear-gradient(90deg, #49BAFF, #9B79FF, #F17BD2, #FF4566)',
    minLabel: '-15°',
    maxLabel: '+35°',
  },
  precipitation: {
    gradient: 'linear-gradient(90deg, #151823, #49BAFF, #9B79FF)',
    minLabel: '0 mm',
    maxLabel: '15+ mm',
  },
  wind: {
    gradient: 'linear-gradient(90deg, #49BAFF, #F17BD2, #FF4566)',
    minLabel: '0 km/h',
    maxLabel: '60+ km/h',
  },
  cloud: {
    gradient: 'linear-gradient(90deg, #151823, #9297A8, #F4F5FA)',
    minLabel: '0%',
    maxLabel: '100%',
  },
};

export function initWeatherMap() {
  const container = document.getElementById('leafletMap');
  if (!container || mapInstance || typeof window.L === 'undefined') return;

  mapInstance = window.L.map(container, {
    center: [currentCenter.latitude, currentCenter.longitude],
    zoom: 7,
    zoomControl: true,
  });

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(mapInstance);

  markersLayer = window.L.layerGroup().addTo(mapInstance);

  mapInstance.on('moveend', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshGridData();
    }, 450);
  });

  bindLayerButtons();
  renderLegend();
  refreshGridData();
}

export function onMapSectionShown(city, unit = 'c') {
  currentUnit = unit;
  if (city) currentCenter = city;

  if (!mapInstance) {
    initWeatherMap();
  }

  if (mapInstance) {
    setTimeout(() => {
      mapInstance.invalidateSize();
      if (city) {
        mapInstance.setView([city.latitude, city.longitude], 7);
      }
      renderLegend();
      refreshGridData();
    }, 60);
  }
}

export function updateMapUnit(unit) {
  currentUnit = unit;
  if (mapInstance) {
    refreshGridData();
  }
}

function bindLayerButtons() {
  const switcher = document.getElementById('mapLayerSwitcher');
  if (!switcher) return;

  switcher.querySelectorAll('.layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      if (!layer || layer === currentLayer) return;
      currentLayer = layer;
      switcher.querySelectorAll('.layer-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderLegend();
      refreshGridData();
    });
  });
}

function renderLegend() {
  const legend = document.getElementById('mapLegend');
  if (!legend) return;
  const meta = LAYER_META[currentLayer] || LAYER_META.temperature;

  legend.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = t(`map.layers.${currentLayer}`);

  const bar = document.createElement('div');
  bar.className = 'map-legend__bar';
  bar.style.background = meta.gradient;

  const scale = document.createElement('div');
  scale.className = 'map-legend__scale';
  const minSpan = document.createElement('span');
  minSpan.textContent = meta.minLabel;
  const maxSpan = document.createElement('span');
  maxSpan.textContent = meta.maxLabel;
  scale.append(minSpan, maxSpan);

  legend.append(title, bar, scale);
}

function buildSamplePoints(bounds) {
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const points = [];
  const rows = 3;
  const cols = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = south + ((r + 0.5) / rows) * (north - south);
      const lon = west + ((c + 0.5) / cols) * (east - west);
      points.push({
        lat: Number(lat.toFixed(2)),
        lon: Number(lon.toFixed(2)),
      });
    }
  }
  return points;
}

async function fetchPointWeather(lat, lon, signal) {
  const key = `${lat}_${lon}`;
  const cached = gridCache.get(key);
  if (cached && Date.now() - cached.ts < GRID_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,precipitation,wind_speed_10m,cloud_cover');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Map grid HTTP ${res.status}`);
  const json = await res.json();
  if (!json.current) throw new Error('Missing current in map grid');

  const item = {
    lat,
    lon,
    tempC: json.current.temperature_2m ?? null,
    precipMm: json.current.precipitation ?? null,
    windKmh: json.current.wind_speed_10m ?? null,
    cloudPct: json.current.cloud_cover ?? null,
  };
  gridCache.set(key, { ts: Date.now(), data: item });
  return item;
}

function getBadgeStyle(item) {
  if (currentLayer === 'temperature') {
    const v = item.tempC ?? 0;
    const bg = v <= 0 ? '#2b6cb0' : v <= 15 ? '#6b46c1' : v <= 26 ? '#b83280' : '#e53e3e';
    return { label: formatTemp(item.tempC, currentUnit), bg };
  }
  if (currentLayer === 'precipitation') {
    const v = item.precipMm ?? 0;
    const bg = v > 0 ? '#2b6cb0' : '#151823';
    return { label: `${v.toFixed(1)} ${t('map.unitMm') || 'mm'}`, bg };
  }
  if (currentLayer === 'wind') {
    const v = item.windKmh ?? 0;
    const bg = v >= 30 ? '#e53e3e' : v >= 15 ? '#805ad5' : '#2c5282';
    return { label: `${Math.round(v)} ${t('map.unitKmh') || 'km/h'}`, bg };
  }
  const v = item.cloudPct ?? 0;
  const bg = v >= 70 ? '#4a5568' : v >= 30 ? '#2d3748' : '#1a202c';
  return { label: `${Math.round(v)}%`, bg };
}

async function refreshGridData() {
  if (!mapInstance || !markersLayer) return;

  if (activeController) activeController.abort();
  activeController = new AbortController();

  const loader = document.getElementById('mapLoader');
  if (loader) loader.hidden = false;

  try {
    const points = buildSamplePoints(mapInstance.getBounds());
    const results = await Promise.all(
      points.map((pt) => fetchPointWeather(pt.lat, pt.lon, activeController.signal))
    );

    markersLayer.clearLayers();

    results.forEach((item) => {
      const { label, bg } = getBadgeStyle(item);
      const icon = window.L.divIcon({
        className: '',
        html: `<div class="weather-grid-pin" style="background:${bg}">${label}</div>`,
        iconSize: [74, 28],
        iconAnchor: [37, 14],
      });

      const marker = window.L.marker([item.lat, item.lon], { icon });
      const popupEl = document.createElement('div');
      popupEl.style.color = '#090A0F';
      popupEl.style.fontSize = '13px';
      popupEl.innerHTML = `
        <strong>${item.lat.toFixed(2)}, ${item.lon.toFixed(2)}</strong><br/>
        ${t('map.popup.temp')}: ${formatTemp(item.tempC, currentUnit)}<br/>
        ${t('map.popup.precip')}: ${(item.precipMm ?? 0).toFixed(1)} mm<br/>
        ${t('map.popup.wind')}: ${Math.round(item.windKmh ?? 0)} km/h<br/>
        ${t('map.popup.cloud')}: ${Math.round(item.cloudPct ?? 0)}%
      `;
      marker.bindPopup(popupEl);
      markersLayer.addLayer(marker);
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      // Fail gracefully without breaking Leaflet UI
    }
  } finally {
    if (loader) loader.hidden = true;
  }
}
