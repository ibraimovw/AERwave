import { formatTemp } from './weather.js';
import { t } from './localization.js';

function buildPolylinePoints(values, width, height, padY = 6) {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((v, idx) => {
      const x = idx * stepX;
      const norm = (v - min) / span;
      const y = height - padY - norm * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function renderHourlySparkline(containerId, hours, unit = 'c') {
  const box = document.getElementById(containerId);
  if (!box || !Array.isArray(hours) || hours.length === 0) return;

  const tempsC = hours.map((h) => h.temperatureC).filter((v) => typeof v === 'number');
  if (!tempsC.length) return;

  const w = 156;
  const h = 34;
  const pts = buildPolylinePoints(tempsC, w, h, 5);
  const minDisp = formatTemp(Math.min(...tempsC), unit);
  const maxDisp = formatTemp(Math.max(...tempsC), unit);

  box.innerHTML = `
    <span class="sparkline-box__label">${t('sparkline.tempTrend')}</span>
    <span class="sparkline-box__range">${minDisp} — ${maxDisp}</span>
    <svg class="sparkline-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <defs>
        <linearGradient id="sparkGradHourly" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#49BAFF" />
          <stop offset="55%" stop-color="#9B79FF" />
          <stop offset="100%" stop-color="#FF4566" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="url(#sparkGradHourly)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />
    </svg>
  `;
}

export function renderDaysSparkline(containerId, days, unit = 'c') {
  const box = document.getElementById(containerId);
  if (!box || !Array.isArray(days) || days.length === 0) return;

  const highsC = days.map((d) => d.tempMaxC).filter((v) => typeof v === 'number');
  if (!highsC.length) return;

  const w = 132;
  const h = 28;
  const pts = buildPolylinePoints(highsC, w, h, 4);
  const minDisp = formatTemp(Math.min(...highsC), unit);
  const maxDisp = formatTemp(Math.max(...highsC), unit);

  box.innerHTML = `
    <span class="sparkline-box__label">${t('sparkline.highsTrend')}</span>
    <span class="sparkline-box__range">${minDisp} — ${maxDisp}</span>
    <svg class="sparkline-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline fill="none" stroke="#FF4566" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />
    </svg>
  `;
}
