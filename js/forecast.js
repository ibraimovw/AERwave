import { t } from './localization.js';
import { formatTemp, getWeatherSvg } from './weather.js';

const PARAM_DEFS = [
  { key: 'temp', labelKey: 'forecast.params.temp', defaultOn: true },
  { key: 'apparent', labelKey: 'forecast.params.apparent', defaultOn: true },
  { key: 'pop', labelKey: 'forecast.params.pop', defaultOn: true },
  { key: 'precip', labelKey: 'forecast.params.precip', defaultOn: false },
  { key: 'humidity', labelKey: 'forecast.params.humidity', defaultOn: true },
  { key: 'wind', labelKey: 'forecast.params.wind', defaultOn: true },
  { key: 'pressure', labelKey: 'forecast.params.pressure', defaultOn: false },
  { key: 'uv', labelKey: 'forecast.params.uv', defaultOn: false },
  { key: 'cloud', labelKey: 'forecast.params.cloud', defaultOn: false },
];

const activeParams = new Set(PARAM_DEFS.filter((p) => p.defaultOn).map((p) => p.key));
let lastDays = [];
let lastUnit = 'c';
let lastLang = 'ru';

export function initForecastFilters() {
  renderFilterChips();
}

export function renderExtendedForecast(days, unit = 'c', lang = 'ru') {
  lastDays = Array.isArray(days) ? days : [];
  lastUnit = unit;
  lastLang = lang;
  renderFilterChips();
  renderTable();
  renderMobileList();
}

function renderFilterChips() {
  const bar = document.getElementById('forecastFilterBar');
  if (!bar) return;
  bar.replaceChildren();

  PARAM_DEFS.forEach((param) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-chip${activeParams.has(param.key) ? ' is-active' : ''}`;
    btn.textContent = t(param.labelKey);
    btn.setAttribute('aria-pressed', String(activeParams.has(param.key)));

    btn.addEventListener('click', () => {
      if (activeParams.has(param.key)) {
        // Keep at least one parameter active
        if (activeParams.size <= 1) return;
        activeParams.delete(param.key);
      } else {
        activeParams.add(param.key);
      }
      renderFilterChips();
      renderTable();
      renderMobileList();
    });

    bar.appendChild(btn);
  });
}

function formatDayLabel(dateStr, lang) {
  const date = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatCellValue(day, key, unit) {
  switch (key) {
    case 'temp':
      return `${formatTemp(day.tempMaxC, unit)} / ${formatTemp(day.tempMinC, unit)}`;
    case 'apparent':
      return `${formatTemp(day.apparentMaxC, unit)} / ${formatTemp(day.apparentMinC, unit)}`;
    case 'pop':
      return typeof day.precipProbMax === 'number' ? `${Math.round(day.precipProbMax)}%` : '—';
    case 'precip':
      return typeof day.precipSumMm === 'number' ? `${day.precipSumMm.toFixed(1)} мм` : '—';
    case 'humidity':
      return typeof day.humidityAvg === 'number' ? `${Math.round(day.humidityAvg)}%` : '—';
    case 'wind':
      return typeof day.windMaxKmh === 'number' ? `${Math.round(day.windMaxKmh)} км/ч` : '—';
    case 'pressure':
      return typeof day.pressureAvg === 'number' ? `${Math.round(day.pressureAvg)} гПа` : '—';
    case 'uv':
      return typeof day.uvMax === 'number' ? day.uvMax.toFixed(1) : '—';
    case 'cloud':
      return typeof day.cloudAvg === 'number' ? `${Math.round(day.cloudAvg)}%` : '—';
    default:
      return '—';
  }
}

function renderTable() {
  const head = document.getElementById('forecastTableHead');
  const body = document.getElementById('forecastTableBody');
  if (!head || !body) return;

  head.replaceChildren();
  body.replaceChildren();

  const activeDefs = PARAM_DEFS.filter((p) => activeParams.has(p.key));
  const headerRow = document.createElement('tr');

  const dateTh = document.createElement('th');
  dateTh.textContent = t('forecast.dateCol');
  headerRow.appendChild(dateTh);

  const iconTh = document.createElement('th');
  iconTh.textContent = '';
  headerRow.appendChild(iconTh);

  activeDefs.forEach((def) => {
    const th = document.createElement('th');
    th.textContent = t(def.labelKey);
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);

  lastDays.forEach((day) => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDayLabel(day.date, lastLang);
    tr.appendChild(tdDate);

    const tdIcon = document.createElement('td');
    tdIcon.innerHTML = `<span class="short-day-row__icon">${getWeatherSvg(day.weatherCode)}</span>`;
    tr.appendChild(tdIcon);

    activeDefs.forEach((def) => {
      const td = document.createElement('td');
      td.textContent = formatCellValue(day, def.key, lastUnit);
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });
}

function renderMobileList() {
  const list = document.getElementById('mobileForecastList');
  if (!list) return;
  list.replaceChildren();

  const activeDefs = PARAM_DEFS.filter((p) => activeParams.has(p.key));

  lastDays.forEach((day) => {
    const card = document.createElement('div');
    card.className = 'm-day-card';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-day-card__summary';
    btn.setAttribute('aria-expanded', 'false');

    const left = document.createElement('span');
    left.textContent = formatDayLabel(day.date, lastLang);

    const mid = document.createElement('span');
    mid.className = 'short-day-row__icon';
    mid.innerHTML = getWeatherSvg(day.weatherCode);

    const right = document.createElement('strong');
    right.textContent = `${formatTemp(day.tempMaxC, lastUnit)} / ${formatTemp(day.tempMinC, lastUnit)}`;

    btn.append(left, mid, right);

    const quickChips = document.createElement('div');
    quickChips.className = 'm-day-card__chips';

    activeDefs.forEach((def) => {
      const chip = document.createElement('span');
      chip.className = 'm-day-card__chip';
      const lbl = document.createElement('span');
      lbl.className = 'm-day-card__chip-label';
      lbl.textContent = `${t(def.labelKey)}: `;
      const val = document.createElement('strong');
      val.textContent = formatCellValue(day, def.key, lastUnit);
      chip.append(lbl, val);
      quickChips.appendChild(chip);
    });

    const details = document.createElement('div');
    details.className = 'm-day-card__details';
    details.hidden = true;

    activeDefs.forEach((def) => {
      const row = document.createElement('div');
      const lbl = document.createElement('span');
      lbl.style.color = 'var(--text-secondary)';
      lbl.textContent = `${t(def.labelKey)}: `;
      const val = document.createElement('strong');
      val.textContent = formatCellValue(day, def.key, lastUnit);
      row.append(lbl, val);
      details.appendChild(row);
    });

    btn.addEventListener('click', () => {
      const nextHidden = !details.hidden;
      details.hidden = nextHidden;
      btn.setAttribute('aria-expanded', String(!nextHidden));
    });

    card.append(btn, quickChips, details);
    list.appendChild(card);
  });
}
