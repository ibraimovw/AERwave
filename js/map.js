import {fetchMapGrid} from './api.js';
import {convertTemp, el, formatTemp} from './helpers.js';

const TILE_SIZE = 256;

function lonToWorldX(lon, zoom) {
  return ((lon + 180) / 360) * TILE_SIZE * Math.pow(2, zoom);
}

function latToWorldY(lat, zoom) {
  const clamped = Math.max(-85, Math.min(85, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * Math.pow(2, zoom);
}

function worldXToLon(wx, zoom) {
  return (wx / (TILE_SIZE * Math.pow(2, zoom))) * 360 - 180;
}

function worldYToLat(wy, zoom) {
  const n = Math.PI - (2 * Math.PI * wy) / (TILE_SIZE * Math.pow(2, zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function getLayerColor(layer, pt) {
  if (layer === 'temp') {
    if (pt.temperature <= -10) return '#3e8cff';
    if (pt.temperature <= 0) return '#635bff';
    if (pt.temperature <= 10) return '#b83dff';
    if (pt.temperature <= 20) return '#f17bd2';
    if (pt.temperature <= 28) return '#ff4f83';
    return '#ff2d68';
  }
  if (layer === 'precip') {
    if (pt.precipitation <= 0.1) return '#64748b';
    if (pt.precipitation <= 1.0) return '#3e8cff';
    if (pt.precipitation <= 4.0) return '#635bff';
    return '#b83dff';
  }
  if (layer === 'wind') {
    if (pt.windSpeed < 12) return '#3e8cff';
    if (pt.windSpeed < 25) return '#635bff';
    if (pt.windSpeed < 40) return '#b83dff';
    return '#ff2d68';
  }
  if (pt.cloudCover < 25) return '#3e8cff';
  if (pt.cloudCover < 60) return '#b83dff';
  return '#cbd5e1';
}

function formatGridValue(layer, pt, unit, t) {
  if (layer === 'temp') return formatTemp(pt.temperature, unit);
  if (layer === 'precip') return `${pt.precipitation.toFixed(1)} ${t.map.units.precip}`;
  if (layer === 'wind') return `${Math.round(pt.windSpeed)} ${t.map.units.wind}`;
  return `${Math.round(pt.cloudCover)}${t.map.units.clouds}`;
}

export function createWeatherMapView({city, cityName, unit, t}) {
  let activeLayer = 'temp';
  let zoom = 6;
  let centerLat = city.latitude;
  let centerLon = city.longitude;
  let gridPoints = [];
  let selectedPoint = null;
  let abortCtrl = null;
  let moveTimer = null;
  let isLoading = false;

  const root = el('div', {className: 'view-stack'});

  // Header panel
  const refreshLabel = el('span', {}, t.map.refreshBtn);
  const refreshBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn-subtle',
      onClick: () => void loadGrid(),
    },
    refreshLabel
  );

  const legendContainer = el('div', {className: 'map-legend-items mono'});
  const layersRow = el('div', {className: 'pill-group'});
  const layerButtons = {};
  for (const layer of ['temp', 'precip', 'wind', 'clouds']) {
    const btn = el(
      'button',
      {
        type: 'button',
        className: `chip-btn ${layer === activeLayer ? 'active' : ''}`,
        onClick: () => {
          activeLayer = layer;
          Object.entries(layerButtons).forEach(([k, b]) => b.classList.toggle('active', k === layer));
          renderLegend();
          renderMarkers();
        },
      },
      t.map.layers[layer]
    );
    layerButtons[layer] = btn;
    layersRow.appendChild(btn);
  }

  const headerCard = el(
    'section',
    {className: 'glass-panel aer-top-accent card-pad'},
    el(
      'div',
      {className: 'row-between gap-md mb-md'},
      el(
        'div',
        {},
        el('div', {className: 'eyebrow'}, el('span', {className: 'aer-eyebrow-line'}), el('span', {}, cityName)),
        el('h1', {className: 'page-title'}, t.map.title),
        el('p', {className: 'muted-sub'}, t.map.subtitle)
      ),
      refreshBtn
    ),
    el(
      'div',
      {className: 'row-between gap-md'},
      layersRow,
      el('div', {className: 'map-legend'}, el('span', {className: 'muted-xs'}, `${t.map.legendTitle}:`), legendContainer)
    )
  );

  // Viewport DOM
  const tileLayer = el('div', {className: 'vmap-tiles'});
  const overlayLayer = el('div', {className: 'vmap-overlays'});
  const popupBox = el('div', {className: 'vmap-popup glass-panel-elevated', hidden: true});

  const zoomInBtn = el(
    'button',
    {
      type: 'button',
      className: 'vmap-zoom-btn',
      'aria-label': 'Zoom in',
      onClick: () => setZoom(zoom + 1),
    },
    '+'
  );
  const zoomOutBtn = el(
    'button',
    {
      type: 'button',
      className: 'vmap-zoom-btn',
      'aria-label': 'Zoom out',
      onClick: () => setZoom(zoom - 1),
    },
    '−'
  );

  const viewport = el(
    'div',
    {className: 'vmap-viewport'},
    tileLayer,
    overlayLayer,
    popupBox,
    el('div', {className: 'vmap-controls'}, zoomInBtn, zoomOutBtn),
    el('div', {className: 'vmap-attrib'}, '© OpenStreetMap · Open-Meteo')
  );

  const mapCard = el('section', {className: 'glass-panel map-card'}, viewport);
  const infoBar = el('div', {className: 'glass-subtle disclaimer-bar'}, t.map.disclaimer);

  root.append(headerCard, mapCard, infoBar);

  function renderLegend() {
    legendContainer.replaceChildren();
    const items =
      activeLayer === 'temp'
        ? [
            {c: '#3e8cff', l: `${convertTemp(-10, unit)}°`},
            {c: '#635bff', l: `${convertTemp(0, unit)}°`},
            {c: '#b83dff', l: `${convertTemp(10, unit)}°`},
            {c: '#f17bd2', l: `${convertTemp(20, unit)}°`},
            {c: '#ff2d68', l: `${convertTemp(30, unit)}°+`},
          ]
        : activeLayer === 'precip'
          ? [
              {c: '#64748b', l: `0`},
              {c: '#3e8cff', l: `0.5`},
              {c: '#635bff', l: `2.5`},
              {c: '#b83dff', l: `4.0+ ${t.map.units.precip}`},
            ]
          : activeLayer === 'wind'
            ? [
                {c: '#3e8cff', l: `<12`},
                {c: '#635bff', l: `20`},
                {c: '#b83dff', l: `35`},
                {c: '#ff2d68', l: `40+ ${t.map.units.wind}`},
              ]
            : [
                {c: '#3e8cff', l: '0–25%'},
                {c: '#b83dff', l: '25–60%'},
                {c: '#cbd5e1', l: '60–100%'},
              ];

    for (const item of items) {
      legendContainer.appendChild(
        el('span', {className: 'legend-item'}, el('span', {className: 'legend-dot', style: {background: item.c}}), item.l)
      );
    }
  }

  function getBounds() {
    const w = viewport.clientWidth || 720;
    const h = viewport.clientHeight || 480;
    const cx = lonToWorldX(centerLon, zoom);
    const cy = latToWorldY(centerLat, zoom);
    return {
      north: worldYToLat(cy - h / 2, zoom),
      south: worldYToLat(cy + h / 2, zoom),
      west: worldXToLon(cx - w / 2, zoom),
      east: worldXToLon(cx + w / 2, zoom),
    };
  }

  function renderTiles() {
    const w = viewport.clientWidth || 720;
    const h = viewport.clientHeight || 480;
    const cx = lonToWorldX(centerLon, zoom);
    const cy = latToWorldY(centerLat, zoom);
    const maxTile = Math.pow(2, zoom);

    const minTx = Math.floor((cx - w / 2) / TILE_SIZE);
    const maxTx = Math.floor((cx + w / 2) / TILE_SIZE);
    const minTy = Math.max(0, Math.floor((cy - h / 2) / TILE_SIZE));
    const maxTy = Math.min(maxTile - 1, Math.floor((cy + h / 2) / TILE_SIZE));

    const frag = document.createDocumentFragment();
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        const left = w / 2 + (tx * TILE_SIZE - cx);
        const top = h / 2 + (ty * TILE_SIZE - cy);
        const img = document.createElement('img');
        img.className = 'vmap-tile';
        img.draggable = false;
        img.alt = '';
        img.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`;
        img.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        frag.appendChild(img);
      }
    }
    tileLayer.replaceChildren(frag);
  }

  function renderMarkers() {
    const w = viewport.clientWidth || 720;
    const h = viewport.clientHeight || 480;
    const cx = lonToWorldX(centerLon, zoom);
    const cy = latToWorldY(centerLat, zoom);
    const frag = document.createDocumentFragment();

    // Active city pin
    const cityPx = w / 2 + (lonToWorldX(city.longitude, zoom) - cx);
    const cityPy = h / 2 + (latToWorldY(city.latitude, zoom) - cy);
    const pin = el(
      'div',
      {
        className: 'vmap-city-pin',
        style: {left: `${cityPx}px`, top: `${cityPy}px`},
        title: `${cityName} (${t.map.activeCity})`,
      },
      el('span', {className: 'vmap-city-dot'}),
      el('span', {className: 'vmap-city-tag'}, cityName)
    );
    frag.appendChild(pin);

    for (const pt of gridPoints) {
      const px = w / 2 + (lonToWorldX(pt.lon, zoom) - cx);
      const py = h / 2 + (latToWorldY(pt.lat, zoom) - cy);
      const color = getLayerColor(activeLayer, pt);
      const badge = el(
        'button',
        {
          type: 'button',
          className: 'vmap-badge mono',
          style: {
            left: `${px}px`,
            top: `${py}px`,
            borderColor: color,
          },
          onClick: (e) => {
            e.stopPropagation();
            selectedPoint = pt;
            showPopup(pt, px, py);
          },
        },
        formatGridValue(activeLayer, pt, unit, t)
      );
      frag.appendChild(badge);
    }

    overlayLayer.replaceChildren(frag);
    if (selectedPoint) {
      const px = w / 2 + (lonToWorldX(selectedPoint.lon, zoom) - cx);
      const py = h / 2 + (latToWorldY(selectedPoint.lat, zoom) - cy);
      popupBox.style.left = `${Math.min(w - 190, Math.max(12, px - 80))}px`;
      popupBox.style.top = `${Math.max(12, py - 120)}px`;
    }
  }

  function showPopup(pt, px, py) {
    const w = viewport.clientWidth || 720;
    popupBox.replaceChildren(
      el(
        'div',
        {className: 'row-between mb-xs'},
        el('strong', {className: 'mono'}, `${pt.lat.toFixed(2)}°, ${pt.lon.toFixed(2)}°`),
        el(
          'button',
          {
            type: 'button',
            className: 'vmap-popup-close',
            onClick: () => {
              selectedPoint = null;
              popupBox.hidden = true;
            },
          },
          '×'
        )
      ),
      el('div', {}, `${t.map.layers.temp}: `, el('strong', {}, formatTemp(pt.temperature, unit))),
      el('div', {}, `${t.map.layers.precip}: `, el('strong', {}, `${pt.precipitation.toFixed(1)} ${t.map.units.precip}`)),
      el('div', {}, `${t.map.layers.wind}: `, el('strong', {}, `${Math.round(pt.windSpeed)} ${t.map.units.wind}`)),
      el('div', {}, `${t.map.layers.clouds}: `, el('strong', {}, `${Math.round(pt.cloudCover)}${t.map.units.clouds}`))
    );
    popupBox.style.left = `${Math.min(w - 190, Math.max(12, px - 80))}px`;
    popupBox.style.top = `${Math.max(12, py - 120)}px`;
    popupBox.hidden = false;
  }

  function setZoom(nextZoom) {
    zoom = Math.max(3, Math.min(11, nextZoom));
    renderTiles();
    renderMarkers();
    scheduleGridLoad();
  }

  function scheduleGridLoad() {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => void loadGrid(), 380);
  }

  async function loadGrid() {
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    isLoading = true;
    refreshLabel.textContent = t.map.refreshing;
    refreshBtn.disabled = true;
    try {
      gridPoints = await fetchMapGrid(getBounds(), abortCtrl.signal);
      if (!abortCtrl.signal.aborted) {
        renderMarkers();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Ignore transient network errors
      }
    } finally {
      if (!abortCtrl.signal.aborted) {
        isLoading = false;
        refreshLabel.textContent = t.map.refreshBtn;
        refreshBtn.disabled = false;
      }
    }
  }

  // Panning via Pointer Events (works smoothly for mouse and mobile touch)
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startCenterX = 0;
  let startCenterY = 0;

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startCenterX = lonToWorldX(centerLon, zoom);
    startCenterY = latToWorldY(centerLat, zoom);
    viewport.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    centerLon = worldXToLon(startCenterX - dx, zoom);
    centerLat = Math.max(-80, Math.min(80, worldYToLat(startCenterY - dy, zoom)));
    if (centerLon > 180) centerLon -= 360;
    if (centerLon < -180) centerLon += 360;
    renderTiles();
    renderMarkers();
  };

  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    scheduleGridLoad();
  };

  const onWheel = (e) => {
    e.preventDefault();
    setZoom(e.deltaY < 0 ? zoom + 1 : zoom - 1);
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('wheel', onWheel, {passive: false});
  viewport.addEventListener('click', (e) => {
    if (!e.target.closest('.vmap-badge') && !e.target.closest('.vmap-popup')) {
      selectedPoint = null;
      popupBox.hidden = true;
    }
  });

  const onResize = () => {
    renderTiles();
    renderMarkers();
  };
  window.addEventListener('resize', onResize);

  renderLegend();
  requestAnimationFrame(() => {
    renderTiles();
    renderMarkers();
    void loadGrid();
  });

  return {
    el: root,
    destroy() {
      if (moveTimer) clearTimeout(moveTimer);
      abortCtrl?.abort();
      window.removeEventListener('resize', onResize);
    },
  };
}
