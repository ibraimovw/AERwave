import {
  applyStaticTranslations,
  buildWeatherInsights,
  getLang,
  getWeatherDescription,
  setLang,
  t,
} from './localization.js';
import {
  fetchWeatherBundle,
  formatTemp,
  getWeatherSvg,
  searchCities,
} from './weather.js';
import { initForecastFilters, renderExtendedForecast } from './forecast.js';
import { onMapSectionShown, updateMapUnit } from './map.js';
import { initHeroParallax, initMagneticCards, updateHeroCityImage } from './images.js';
import { renderDaysSparkline, renderHourlySparkline } from './sparklines.js';
import { initNavigation, switchSection } from './navigation.js';

const STORAGE_UNIT_KEY = 'aeriq_unit_v4';
const STORAGE_FAV_KEY = 'aeriq_favorites_v4';
const STORAGE_LAST_CITY_KEY = 'aeriq_last_city_v4';
const MAX_FAVORITES = 10;
const STORAGE_WEATHER_CACHE_KEY = 'aeriq_weather_cache_v4';

function saveWeatherCache(city, weather) {
  try {
    const cache = loadJson(STORAGE_WEATHER_CACHE_KEY, {});
    const key = `${city.latitude.toFixed(3)}_${city.longitude.toFixed(3)}`;
    cache[key] = {
      savedAt: Date.now(),
      weather,
    };
    saveJson(STORAGE_WEATHER_CACHE_KEY, cache);
  } catch {
    // Ignore storage error
  }
}

function loadWeatherCache(city) {
  try {
    const cache = loadJson(STORAGE_WEATHER_CACHE_KEY, {});
    const key = `${city.latitude.toFixed(3)}_${city.longitude.toFixed(3)}`;
    return cache[key] || null;
  } catch {
    return null;
  }
}


const DEFAULT_CITY = {
  id: 1528675,
  name: 'Бишкек',
  admin1: 'Чуйская область',
  country: 'Кыргызстан',
  latitude: 42.8746,
  longitude: 74.5698,
  timezone: 'Asia/Bishkek',
};

const state = {
  city: loadJson(STORAGE_LAST_CITY_KEY, DEFAULT_CITY),
  weather: null,
  unit: localStorage.getItem(STORAGE_UNIT_KEY) === 'f' ? 'f' : 'c',
  favorites: loadJson(STORAGE_FAV_KEY, []),
  activeSection: 'home',
};

let weatherAbort = null;
let imageAbort = null;
let searchAbort = null;
let searchTimer = null;

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage error
  }
}

function showBanner(message) {
  const banner = document.getElementById('statusBanner');
  if (!banner) return;
  if (!message) {
    banner.hidden = true;
    banner.textContent = '';
  } else {
    banner.textContent = message;
    banner.hidden = false;
  }
}

function syncControlLabels() {
  const lang = getLang().toUpperCase();
  const unit = state.unit === 'f' ? '°F' : '°C';

  const langHeaderEl = document.getElementById('langLabelHeader');
  if (langHeaderEl) langHeaderEl.textContent = lang;

  const unitHeaderEl = document.getElementById('unitLabelHeader');
  if (unitHeaderEl) unitHeaderEl.textContent = unit;

  updateFavoriteButtonState();
}

function isCitySaved(city) {
  return state.favorites.some(
    (f) => Math.abs(f.latitude - city.latitude) < 0.02 && Math.abs(f.longitude - city.longitude) < 0.02
  );
}

function updateFavoriteButtonState() {
  const btn = document.getElementById('favoriteToggleBtn');
  const icon = document.getElementById('favoriteStarIcon');
  const textEl = btn?.querySelector('.chip-control__text');
  if (!btn || !icon) return;

  const saved = isCitySaved(state.city);
  btn.classList.toggle('is-saved', saved);
  icon.textContent = saved ? '★' : '☆';
  if (textEl) {
    textEl.textContent = saved ? t('actions.savedCity') : t('actions.saveCity');
  }
}

function toggleFavoriteCity(city) {
  const idx = state.favorites.findIndex(
    (f) => Math.abs(f.latitude - city.latitude) < 0.02 && Math.abs(f.longitude - city.longitude) < 0.02
  );

  if (idx >= 0) {
    state.favorites.splice(idx, 1);
  } else {
    if (state.favorites.length >= MAX_FAVORITES) {
      showBanner(t('favorites.limitReached'));
      return;
    }
    state.favorites.push(city);
  }

  saveJson(STORAGE_FAV_KEY, state.favorites);
  updateFavoriteButtonState();
  renderFavoritesSection();
}

async function selectCity(city) {
  state.city = city;
  saveJson(STORAGE_LAST_CITY_KEY, city);
  updateFavoriteButtonState();

  if (weatherAbort) weatherAbort.abort();
  if (imageAbort) imageAbort.abort();

  weatherAbort = new AbortController();
  imageAbort = new AbortController();

  updateHeroCityImage(city, imageAbort.signal);

  const showCachedIfAvailable = () => {
    const cached = loadWeatherCache(city);
    if (cached && cached.weather) {
      state.weather = cached.weather;
      renderAllViews();
      const timeLabel = new Intl.DateTimeFormat(getLang() === 'en' ? 'en-US' : 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      }).format(new Date(cached.savedAt));
      showBanner(t('errors.offlineCached', { time: timeLabel }));
      return true;
    }
    return false;
  };

  if (!navigator.onLine) {
    if (!showCachedIfAvailable()) {
      showBanner(t('errors.offline'));
    }
    return;
  }

  try {
    showBanner('');
    const weather = await fetchWeatherBundle(city, weatherAbort.signal);
    state.weather = weather;
    saveWeatherCache(city, weather);
    renderAllViews();
  } catch (err) {
    if (err.name !== 'AbortError') {
      if (!showCachedIfAvailable()) {
        showBanner(t('errors.weatherFailed'));
      }
    }
  }
}

function updateDayPhaseTheme(weather) {
  const body = document.body;
  if (!body || !weather?.current) return;

  const currentIso = weather.current.time || '';
  const today = weather.days?.[0];

  if (today?.sunrise && today?.sunset && currentIso) {
    const nowMs = new Date(currentIso).getTime();
    const riseMs = new Date(today.sunrise).getTime();
    const setMs = new Date(today.sunset).getTime();

    if (Number.isFinite(nowMs) && Number.isFinite(riseMs) && Number.isFinite(setMs)) {
      const min = 60 * 1000;
      if (nowMs >= riseMs - 35 * min && nowMs < riseMs + 95 * min) {
        body.dataset.dayphase = 'dawn';
        return;
      }
      if (nowMs >= riseMs + 95 * min && nowMs < setMs - 65 * min) {
        body.dataset.dayphase = 'day';
        return;
      }
      if (nowMs >= setMs - 65 * min && nowMs <= setMs + 45 * min) {
        body.dataset.dayphase = 'dusk';
        return;
      }
      body.dataset.dayphase = 'night';
      return;
    }
  }

  body.dataset.dayphase = weather.current.isDay ? 'day' : 'night';
}

function renderAllViews() {
  if (!state.weather) return;
  updateDayPhaseTheme(state.weather);
  renderHeroPanel();
  renderInsights();
  renderMetrics();
  renderDaylight();
  renderHourly();
  renderShort8Days();

  const subtitle = document.getElementById('forecastSubtitle');
  if (subtitle) {
    subtitle.textContent = `${state.city.name} · ${t('forecast.subtitle')}`;
  }
  renderExtendedForecast(state.weather.days, state.unit, getLang());

  renderHourlySparkline('hourlySparklineBox', state.weather.next24, state.unit);
  renderDaysSparkline('weeklySparklineBox', state.weather.days?.slice(0, 8), state.unit);
  renderDaysSparkline('forecast16SparklineBox', state.weather.days, state.unit);

  if (state.activeSection === 'map') {
    onMapSectionShown(state.city, state.unit);
  }
}

function renderHeroPanel() {
  const { city, weather, unit } = state;
  const c = weather.current;
  const today = weather.days[0];

  document.getElementById('heroCity').textContent = city.name;
  document.getElementById('heroCountry').textContent = [city.admin1, city.country].filter(Boolean).join(', ');
  document.getElementById('heroTemp').textContent = formatTemp(c.temperatureC, unit);
  document.getElementById('heroCondition').textContent = getWeatherDescription(c.weatherCode);
  document.getElementById('heroWeatherIcon').innerHTML = getWeatherSvg(c.weatherCode);
  document.getElementById('heroFeelsLike').textContent = formatTemp(c.apparentTemperatureC, unit);
  document.getElementById('heroMaxTemp').textContent = today ? formatTemp(today.tempMaxC, unit) : '—';
  document.getElementById('heroMinTemp').textContent = today ? formatTemp(today.tempMinC, unit) : '—';

  try {
    const localTimeStr = new Intl.DateTimeFormat(getLang() === 'en' ? 'en-US' : 'ru-RU', {
      timeZone: weather.timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).format(new Date());
    document.getElementById('heroLocalTime').textContent = localTimeStr;
  } catch {
    document.getElementById('heroLocalTime').textContent = c.time?.slice(11, 16) || '--:--';
  }
}

function renderInsights() {
  const container = document.getElementById('insightsList');
  if (!container) return;
  container.replaceChildren();

  const insights = buildWeatherInsights(state.weather, state.unit);
  insights.forEach((item) => {
    const card = document.createElement('div');
    card.className = `insight-card insight-card--${item.tone}`;
    card.textContent = item.text;
    container.appendChild(card);
  });
}

function renderMetrics() {
  const c = state.weather.current;
  const noData = t('metrics.noData');

  document.getElementById('metricHumidity').textContent =
    typeof c.humidity === 'number' ? `${Math.round(c.humidity)}%` : noData;

  document.getElementById('metricWind').textContent =
    typeof c.windSpeedKmh === 'number' ? `${Math.round(c.windSpeedKmh)} км/ч` : noData;

  document.getElementById('metricPressure').textContent =
    typeof c.pressureHpa === 'number' ? `${Math.round(c.pressureHpa)} гПа` : noData;

  document.getElementById('metricVisibility').textContent =
    typeof c.visibilityKm === 'number' ? `${c.visibilityKm} км` : noData;

  document.getElementById('metricUv').textContent =
    typeof c.uvIndex === 'number' ? c.uvIndex.toFixed(1) : noData;

  document.getElementById('metricDewPoint').textContent =
    typeof c.dewPointC === 'number' ? formatTemp(c.dewPointC, state.unit) : noData;
}

function renderDaylight() {
  const today = state.weather.days[0];
  if (!today || !today.sunrise || !today.sunset) return;

  const sunriseStr = today.sunrise.slice(11, 16);
  const sunsetStr = today.sunset.slice(11, 16);
  document.getElementById('sunriseTime').textContent = sunriseStr;
  document.getElementById('sunsetTime').textContent = sunsetStr;

  const startMs = new Date(today.sunrise).getTime();
  const endMs = new Date(today.sunset).getTime();
  const nowMs = new Date(state.weather.current.time).getTime();

  const totalMin = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  document.getElementById('daylightDuration').textContent = t('daylight.durationFmt', { h, m });

  const progress = endMs > startMs ? Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs))) : 0.5;
  // Quadratic Bezier point M 20 80 Q 130 -10 240 80
  const tVal = progress;
  const x = (1 - tVal) * (1 - tVal) * 20 + 2 * (1 - tVal) * tVal * 130 + tVal * tVal * 240;
  const y = (1 - tVal) * (1 - tVal) * 80 + 2 * (1 - tVal) * tVal * -10 + tVal * tVal * 80;

  const dot = document.getElementById('sunPositionDot');
  if (dot) {
    dot.setAttribute('cx', x.toFixed(1));
    dot.setAttribute('cy', y.toFixed(1));
  }
}

function renderHourly() {
  const strip = document.getElementById('hourlyStrip');
  if (!strip) return;
  strip.replaceChildren();

  state.weather.next24.forEach((hour) => {
    const card = document.createElement('div');
    card.className = `hour-card${hour.isNow ? ' is-now' : ''}`;

    const timeEl = document.createElement('span');
    timeEl.className = 'hour-card__time';
    timeEl.textContent = hour.time.slice(11, 16);

    const iconEl = document.createElement('span');
    iconEl.className = 'hour-card__icon';
    iconEl.innerHTML = getWeatherSvg(hour.weatherCode);

    const tempEl = document.createElement('span');
    tempEl.className = 'hour-card__temp';
    tempEl.textContent = formatTemp(hour.temperatureC, state.unit);

    const popEl = document.createElement('span');
    popEl.className = 'hour-card__pop';
    popEl.textContent =
      typeof hour.precipitationProbability === 'number' ? `${hour.precipitationProbability}%` : '0%';

    card.append(timeEl, iconEl, tempEl, popEl);
    strip.appendChild(card);
  });
}

function renderShort8Days() {
  const list = document.getElementById('shortDaysList');
  if (!list) return;
  list.replaceChildren();

  const locale = getLang() === 'en' ? 'en-US' : 'ru-RU';

  state.weather.days.slice(0, 8).forEach((day) => {
    const row = document.createElement('div');
    row.className = 'short-day-row';

    const name = document.createElement('span');
    name.className = 'short-day-row__name';
    const dObj = new Date(`${day.date}T12:00:00`);
    name.textContent = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(dObj);

    const icon = document.createElement('span');
    icon.className = 'short-day-row__icon';
    icon.innerHTML = getWeatherSvg(day.weatherCode);

    const temps = document.createElement('div');
    temps.className = 'short-day-row__temps';
    const maxSpan = document.createElement('strong');
    maxSpan.textContent = formatTemp(day.tempMaxC, state.unit);
    const minSpan = document.createElement('span');
    minSpan.className = 'short-day-row__min';
    minSpan.textContent = formatTemp(day.tempMinC, state.unit);
    temps.append(maxSpan, minSpan);

    row.append(name, icon, temps);
    list.appendChild(row);
  });
}

async function renderFavoritesSection() {
  const grid = document.getElementById('favoritesGrid');
  const counter = document.getElementById('favoritesCounter');
  if (!grid) return;

  if (counter) {
    counter.textContent = `${state.favorites.length} / ${MAX_FAVORITES}`;
  }

  grid.replaceChildren();

  if (state.favorites.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'fav-empty';
    empty.textContent = t('favorites.empty');
    grid.appendChild(empty);
    return;
  }

  for (const favCity of state.favorites) {
    const card = document.createElement('article');
    card.className = 'fav-card';

    const top = document.createElement('div');
    top.className = 'fav-card__top';

    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'fav-card__city';
    title.textContent = favCity.name;
    const sub = document.createElement('p');
    sub.className = 'fav-card__country';
    sub.textContent = [favCity.admin1, favCity.country].filter(Boolean).join(', ');
    info.append(title, sub);

    const rightBox = document.createElement('div');
    rightBox.className = 'fav-card__weather';

    const iconBox = document.createElement('span');
    iconBox.className = 'fav-card__icon';

    const temp = document.createElement('span');
    temp.className = 'fav-card__temp';
    temp.textContent = '--°';

    rightBox.append(iconBox, temp);
    top.append(info, rightBox);

    const rangeEl = document.createElement('div');
    rangeEl.className = 'fav-card__range';
    rangeEl.textContent = `${t('hero.min')}: --° · ${t('hero.max')}: --°`;

    const actions = document.createElement('div');
    actions.className = 'fav-card__actions';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'primary-btn';
    openBtn.textContent = t('actions.openCity');
    openBtn.addEventListener('click', () => {
      selectCity(favCity);
      switchSection('home', (sec) => {
        state.activeSection = sec;
      });
    });

    const mapBtn = document.createElement('button');
    mapBtn.type = 'button';
    mapBtn.className = 'chip-control';
    mapBtn.textContent = t('map.viewOnMap');
    mapBtn.addEventListener('click', () => {
      state.city = favCity;
      saveJson(STORAGE_LAST_CITY_KEY, favCity);
      updateFavoriteButtonState();
      switchSection('map', (sec) => {
        state.activeSection = sec;
        onMapSectionShown(favCity, state.unit);
      });
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-control';
    removeBtn.textContent = t('actions.remove');
    removeBtn.addEventListener('click', () => {
      toggleFavoriteCity(favCity);
    });

    actions.append(openBtn, mapBtn, removeBtn);
    card.append(top, rangeEl, actions);
    grid.appendChild(card);

    fetchWeatherBundle(favCity)
      .then((w) => {
        temp.textContent = formatTemp(w.current.temperatureC, state.unit);
        iconBox.innerHTML = getWeatherSvg(w.current.weatherCode);
        const today = w.days?.[0];
        if (today) {
          rangeEl.textContent = `${t('hero.min')}: ${formatTemp(today.tempMinC, state.unit)} · ${t('hero.max')}: ${formatTemp(today.tempMaxC, state.unit)}`;
        }
      })
      .catch(() => {
        temp.textContent = '—';
      });
  }
}

function initSearch() {
  const input = document.getElementById('citySearchInput');
  const dropdown = document.getElementById('searchDropdown');
  const spinner = document.getElementById('searchSpinner');
  const container = document.getElementById('searchContainer');
  if (!input || !dropdown || !container) return;

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = input.value.trim();

    if (query.length < 2) {
      dropdown.hidden = true;
      dropdown.replaceChildren();
      return;
    }

    searchTimer = setTimeout(async () => {
      if (searchAbort) searchAbort.abort();
      searchAbort = new AbortController();
      if (spinner) spinner.hidden = false;

      try {
        const results = await searchCities(query, getLang(), searchAbort.signal);
        dropdown.replaceChildren();

        if (results.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'search__empty';
          empty.textContent = t('search.empty');
          dropdown.appendChild(empty);
        } else {
          results.forEach((city) => {
            const li = document.createElement('li');
            li.className = 'search__option';
            li.tabIndex = 0;

            const nameEl = document.createElement('span');
            nameEl.className = 'search__option-city';
            nameEl.textContent = city.name;

            const subEl = document.createElement('span');
            subEl.className = 'search__option-sub';
            subEl.textContent = [city.admin1, city.country].filter(Boolean).join(', ');

            li.append(nameEl, subEl);
            li.addEventListener('click', () => {
              input.value = city.name;
              dropdown.hidden = true;
              selectCity(city);
            });
            dropdown.appendChild(li);
          });
        }
        dropdown.hidden = false;
      } catch (err) {
        if (err.name !== 'AbortError') {
          dropdown.replaceChildren();
          const errItem = document.createElement('li');
          errItem.className = 'search__empty';
          errItem.textContent = t('search.error');
          dropdown.appendChild(errItem);
          dropdown.hidden = false;
        }
      } finally {
        if (spinner) spinner.hidden = true;
      }
    }, 320);
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.hidden = true;
    }
  });
}

function bindGlobalControls() {
  const toggleLang = () => {
    const next = getLang() === 'ru' ? 'en' : 'ru';
    setLang(next);
    syncControlLabels();
    renderAllViews();
    renderFavoritesSection();
  };

  const toggleUnit = () => {
    state.unit = state.unit === 'c' ? 'f' : 'c';
    localStorage.setItem(STORAGE_UNIT_KEY, state.unit);
    syncControlLabels();
    renderAllViews();
    renderFavoritesSection();
    updateMapUnit(state.unit);
  };

  document.getElementById('langBtnHeader')?.addEventListener('click', toggleLang);
  document.getElementById('unitBtnHeader')?.addEventListener('click', toggleUnit);

  document.getElementById('favoriteToggleBtn')?.addEventListener('click', () => {
    toggleFavoriteCity(state.city);
  });

  document.getElementById('addCurrentFavBtn')?.addEventListener('click', () => {
    if (!isCitySaved(state.city)) {
      toggleFavoriteCity(state.city);
    }
  });

  window.addEventListener('online', () => {
    showBanner('');
    selectCity(state.city);
  });

  window.addEventListener('offline', () => {
    showBanner(t('errors.offline'));
  });
}

function bootstrap() {
  setLang(getLang());
  applyStaticTranslations();
  syncControlLabels();
  initForecastFilters();
  initHeroParallax();
  initMagneticCards();
  initSearch();
  bindGlobalControls();

  initNavigation((section) => {
    state.activeSection = section;
    if (section === 'map') {
      onMapSectionShown(state.city, state.unit);
    } else if (section === 'favorites') {
      renderFavoritesSection();
    }
  });

  renderFavoritesSection();
  selectCity(state.city);
}

bootstrap();
