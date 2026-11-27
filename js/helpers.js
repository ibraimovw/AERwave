// Создание DOM-элемента с атрибутами и детьми
function appendChildren(parent, items) {
  for (let i = 0; i < items.length; i++) {
    const child = items[i];
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    }
  }
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'className') {
      node.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  appendChildren(node, children);
  return node;
}

// Обновление содержимого контейнера
export function setChildren(parent, ...children) {
  if (!parent) return;
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, children);
  parent.replaceChildren(fragment);
}

// Подсветка карточки за курсором мыши
export function attachSpotlight(node) {
  node.classList.add('glass-spotlight');
  node.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    node.style.setProperty('--my', `${e.clientY - rect.top}px`);
    node.style.setProperty('--spotlight-opacity', '1');
  });
  node.addEventListener('pointerleave', () => {
    node.style.setProperty('--spotlight-opacity', '0');
  });
  return node;
}

// Лёгкий магнитный эффект для кнопок на ПК
export function initMagneticButtons() {
  if (typeof window === 'undefined') return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const selector =
    '.btn-primary, .btn-subtle, .btn-icon, .btn-theme-circle, .seg-btn, .preset-btn, .chip-btn';
  let activeEl = null;

  function resetActive() {
    if (!activeEl) return;
    activeEl.style.setProperty('--mag-x', '0px');
    activeEl.style.setProperty('--mag-y', '0px');
    activeEl = null;
  }

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const target = e.target instanceof Element ? e.target.closest(selector) : null;
      if (!target || target.disabled) {
        resetActive();
        return;
      }

      if (activeEl && activeEl !== target) {
        activeEl.style.setProperty('--mag-x', '0px');
        activeEl.style.setProperty('--mag-y', '0px');
      }
      activeEl = target;

      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      const pull = target.classList.contains('btn-primary') ? 5.5 : 3.5;

      target.style.setProperty('--mag-x', `${(nx * pull).toFixed(2)}px`);
      target.style.setProperty('--mag-y', `${(ny * pull).toFixed(2)}px`);
    },
    {passive: true}
  );

  document.addEventListener('pointerleave', resetActive, true);
  window.addEventListener('blur', resetActive);
}

// Перевод и форматирование температуры
export function convertTemp(tempC, unit) {
  if (unit === 'F') {
    return Math.round((tempC * 9) / 5 + 32);
  }
  return Math.round(tempC);
}

export function convertTempExact(tempC, unit) {
  if (unit === 'F') {
    return (tempC * 9) / 5 + 32;
  }
  return tempC;
}

export function formatTemp(tempC, unit) {
  return `${convertTemp(tempC, unit)}°`;
}

// Определяем тип погоды для фона
export function getWeatherMood(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'rain';
}

// Местное время в выбранном городе
export function getCityLocalClock(timezone, nowMs = Date.now()) {
  try {
    const d = new Date(nowMs);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const getPart = (type) => parts.find((p) => p.type === type)?.value ?? '00';
    const hour = Number(getPart('hour')) % 24;
    const minute = Number(getPart('minute'));

    return {
      dateStr: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
      minutesOfDay: hour * 60 + minute,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  } catch {
    const d = new Date(nowMs);
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    return {
      dateStr: d.toISOString().slice(0, 10),
      minutesOfDay: hour * 60 + minute,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  }
}

export function parseIsoMinutes(isoStr) {
  const match = /T(\d{2}):(\d{2})/.exec(isoStr || '');
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatIsoTime(isoStr) {
  const match = /T(\d{2}:\d{2})/.exec(isoStr || '');
  return match ? match[1] : '--:--';
}

// Фаза суток (рассвет, день, закат, ночь)
export function computeDayPhase(timezone, sunriseIso, sunsetIso, nowMs = Date.now()) {
  const {minutesOfDay} = getCityLocalClock(timezone, nowMs);
  const sunrise = sunriseIso ? parseIsoMinutes(sunriseIso) : 6 * 60 + 30;
  const sunset = sunsetIso ? parseIsoMinutes(sunsetIso) : 18 * 60 + 30;

  if (minutesOfDay >= sunrise - 45 && minutesOfDay < sunrise + 75) return 'dawn';
  if (minutesOfDay >= sunrise + 75 && minutesOfDay < sunset - 75) return 'day';
  if (minutesOfDay >= sunset - 75 && minutesOfDay < sunset + 45) return 'dusk';
  return 'night';
}

function fmtMins(mins) {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const minutes = String(wrapped % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Положение солнца и длина светового дня
export function computeSunProgress(timezone, sunriseIso, sunsetIso, nowMs = Date.now()) {
  const {minutesOfDay} = getCityLocalClock(timezone, nowMs);
  const sunrise = parseIsoMinutes(sunriseIso);
  const sunset = parseIsoMinutes(sunsetIso);
  const span = Math.max(60, sunset - sunrise);
  const daylightHours = Math.floor(span / 60);
  const daylightMinutes = span % 60;
  const goldenMorning = `${fmtMins(sunrise)}–${fmtMins(sunrise + 50)}`;
  const goldenEvening = `${fmtMins(sunset - 50)}–${fmtMins(sunset)}`;

  if (minutesOfDay < sunrise) {
    return {progress: 0, state: 'before', daylightHours, daylightMinutes, goldenMorning, goldenEvening};
  }
  if (minutesOfDay > sunset) {
    return {progress: 1, state: 'after', daylightHours, daylightMinutes, goldenMorning, goldenEvening};
  }

  return {
    progress: Math.min(1, Math.max(0, (minutesOfDay - sunrise) / span)),
    state: 'during',
    daylightHours,
    daylightMinutes,
    goldenMorning,
    goldenEvening,
  };
}

// Фаза луны и процент освещённости
export function computeMoonPhase(nowMs = Date.now(), lang = 'ru') {
  const synodicDays = 29.53058867;
  const knownNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (nowMs - knownNewMoonMs) / 86400000;
  const phase = (((daysSince / synodicDays) % 1) + 1) % 1;
  const illumination = Math.round(((1 - Math.cos(phase * Math.PI * 2)) / 2) * 100);
  const isRu = lang === 'ru';

  let name = isRu ? 'Старая луна' : 'Waning Crescent';
  if (phase < 0.04 || phase >= 0.96) name = isRu ? 'Новолуние' : 'New Moon';
  else if (phase < 0.21) name = isRu ? 'Растущий серп' : 'Waxing Crescent';
  else if (phase < 0.29) name = isRu ? 'Первая четверть' : 'First Quarter';
  else if (phase < 0.46) name = isRu ? 'Растущая луна' : 'Waxing Gibbous';
  else if (phase < 0.54) name = isRu ? 'Полнолуние' : 'Full Moon';
  else if (phase < 0.71) name = isRu ? 'Убывающая луна' : 'Waning Gibbous';
  else if (phase < 0.79) name = isRu ? 'Последняя четверть' : 'Last Quarter';

  return {name, illumination};
}

// Тренд давления за последние часы
export function computePressureTrend(weather) {
  const {dateStr, minutesOfDay} = getCityLocalClock(weather.timezone);
  const hourStr = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const currentIsoHour = `${dateStr}T${hourStr}:00`;
  const idx = weather.hourly.findIndex((h) => h.time >= currentIsoHour);
  if (idx <= 2) return 'steady';

  const prev = weather.hourly[Math.max(0, idx - 3)]?.pressure ?? weather.current.pressure;
  const diff = weather.current.pressure - prev;
  if (diff >= 1.5) return 'rising';
  if (diff <= -1.5) return 'falling';
  return 'steady';
}

// Берём ближайшие 24 часа прогноза
export function getNext24Hours(weather) {
  const {dateStr, minutesOfDay} = getCityLocalClock(weather.timezone);
  const hourStr = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const currentIsoHour = `${dateStr}T${hourStr}:00`;
  const idx = weather.hourly.findIndex((h) => h.time >= currentIsoHour);
  const start = idx >= 0 ? idx : 0;
  return weather.hourly.slice(start, start + 24);
}

// Форматирование даты для карточек и таблицы
export function formatDateLabel(dateStr, lang, style = 'short') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';

  if (style === 'weekday') {
    return new Intl.DateTimeFormat(locale, {weekday: 'short', timeZone: 'UTC'}).format(utcDate);
  }
  if (style === 'full') {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(utcDate);
  }
  return new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(utcDate);
}

export function getWindDirectionLabel(deg, labels) {
  const norm = ((deg % 360) + 360) % 360;
  return labels[Math.round(norm / 45) % 8] ?? labels[0];
}

export function getUvCategory(uv, uvLevels) {
  if (uv < 3) return uvLevels.low;
  if (uv < 6) return uvLevels.moderate;
  if (uv < 8) return uvLevels.high;
  if (uv < 11) return uvLevels.veryHigh;
  return uvLevels.extreme;
}

// Находим максимальный порыв ветра за 24 часа
function findMaxWind(initialWind, hoursList, useGusts) {
  let maxVal = initialWind;
  for (const h of hoursList) {
    const value = useGusts ? h.windGusts || h.windSpeed : h.windSpeed;
    if (value > maxVal) maxVal = value;
  }
  return maxVal;
}

// Короткая сводка погоды на главной карточке
export function generateHeroDailySummary(weather, _unit, lang) {
  const next24 = getNext24Hours(weather);
  const wetHour = next24.find((h) => h.precipProb >= 55 || h.precipitation >= 0.4);
  const maxWind24 = findMaxWind(weather.current.windGusts, next24, true);

  if (lang === 'ru') {
    const precipText = wetHour
      ? `Осадки вероятны около ${formatIsoTime(wetHour.time)}`
      : 'В ближайшие 24 ч без существенных осадков';
    const windText =
      maxWind24 >= 10 ? `, порывы ветра до ${Math.round(maxWind24)} м/с` : ', ветер умеренный';
    return `${precipText}${windText}.`;
  }

  const precipText = wetHour
    ? `Precipitation likely around ${formatIsoTime(wetHour.time)}`
    : 'Mostly dry over the next 24 hours';
  const windText =
    maxWind24 >= 10 ? `, wind gusts up to ${Math.round(maxWind24)} m/s` : ', gentle breeze';
  return `${precipText}${windText}.`;
}

// Предупреждения о сложных погодных условиях
export function generateWeatherAlerts(weather, lang) {
  const alerts = [];
  const next24 = getNext24Hours(weather);
  const isRu = lang === 'ru';

  let maxGust = weather.current.windGusts;
  let minTemp24 = weather.current.temperature;
  let hasPrecip = false;

  for (const h of next24) {
    if ((h.windGusts || 0) > maxGust) maxGust = h.windGusts || 0;
    if (h.temperature < minTemp24) minTemp24 = h.temperature;
    if (h.precipitation > 0.1) hasPrecip = true;
  }

  const stormCodes = [95, 96, 99, 65, 82];
  if (stormCodes.includes(weather.current.weatherCode)) {
    alerts.push({
      title: isRu ? 'Шторм / интенсивные осадки' : 'Storm & Heavy Rain Warning',
      description: isRu
        ? 'Возможны сильные ливни или гроза. Избегайте открытых пространств и низин.'
        : 'Heavy rain or thunderstorm activity expected. Seek shelter if outdoors.',
    });
  }

  if (maxGust >= 14) {
    alerts.push({
      title: isRu
        ? `Сильные порывы до ${Math.round(maxGust)} м/с`
        : `Strong Gusts (${Math.round(maxGust)} m/s)`,
      description: isRu
        ? 'Ожидается усиление ветра в ближайшие 24 часа.'
        : 'Strong wind gusts expected over the next 24 hours.',
    });
  }

  if (minTemp24 <= 1 && hasPrecip) {
    alerts.push({
      title: isRu ? 'Риск гололедицы' : 'Black Ice Risk',
      description: isRu
        ? 'Температура около или ниже 0° при осадках — на дорогах возможен лёд.'
        : 'Sub-freezing temperatures combined with moisture may create slick surfaces.',
    });
  }

  if ((weather.airQuality?.europeanAqi ?? 0) >= 60) {
    const aqiVal = weather.airQuality.europeanAqi;
    const pm25 = weather.airQuality.pm25;
    alerts.push({
      title: isRu ? `Пониженное качество воздуха (AQI ${aqiVal})` : `Elevated Air Pollution (AQI ${aqiVal})`,
      description: isRu
        ? `Повышенная концентрация частиц PM2.5 (${pm25} мкг/м³).`
        : `Elevated PM2.5 concentration (${pm25} µg/m³).`,
    });
  }

  return alerts;
}

// Простые советы по одежде, ветру и осадкам
export function generateWeatherInsights(weather, unit, lang) {
  const insights = [];
  const next24 = getNext24Hours(weather);
  const {current} = weather;
  const isRu = lang === 'ru';

  if (current.temperature <= 0) {
    insights.push({
      severity: 'notice',
      title: isRu ? 'Гардероб: зимняя защита' : 'Wardrobe: Sub-zero Layering',
      description: isRu
        ? 'Тёплый пуховик, шарф и перчатки обязательны при температуре ниже нуля.'
        : 'Insulated winter coat, gloves, and warm layers recommended.',
    });
  } else if (current.temperature <= 12) {
    insights.push({
      severity: 'info',
      title: isRu ? 'Гардероб: многослойность' : 'Wardrobe: Layered Outerwear',
      description: isRu
        ? 'Подойдут ветровка, пальто или плотный трикотаж.'
        : 'A windproof jacket or layered sweater fits current temperatures.',
    });
  } else {
    insights.push({
      severity: 'info',
      title: isRu ? 'Гардероб: комфортно' : 'Wardrobe: Light & Breathable',
      description: isRu
        ? 'Достаточно лёгкой одежды без тяжёлого утепления.'
        : 'Breathable casual wear is comfortable right now.',
    });
  }

  const rainPeak = next24.find((h) => h.precipProb >= 45 || h.precipitation >= 0.3);
  if (rainPeak) {
    const prob = Math.round(rainPeak.precipProb);
    insights.push({
      severity: prob >= 70 ? 'alert' : 'notice',
      title: isRu ? `Осадки около ${formatIsoTime(rainPeak.time)}` : `Rain Window ~${formatIsoTime(rainPeak.time)}`,
      description: isRu
        ? `Вероятность ${prob}% — возьмите зонт или непромокаемую куртку.`
        : `${prob}% precipitation chance — bring an umbrella.`,
    });
  } else {
    insights.push({
      severity: 'info',
      title: isRu ? 'Сухое окно 24 ч' : 'Dry 24-Hour Window',
      description: isRu
        ? 'Существенных осадков не ожидается — комфортно для прогулок и поездок.'
        : 'No significant rain expected — ideal conditions for outdoor plans.',
    });
  }

  const diff = current.temperature - current.apparentTemperature;
  if (Math.abs(diff) >= 3) {
    let feelsTitle;
    if (diff > 0) {
      feelsTitle = isRu ? `Ощущается холоднее на ${Math.round(diff)}°` : `Feels ${Math.round(diff)}° Colder`;
    } else {
      feelsTitle = isRu ? `Ощущается теплее на ${Math.round(-diff)}°` : `Feels ${Math.round(-diff)}° Warmer`;
    }
    const feelsText = formatTemp(current.apparentTemperature, unit);
    insights.push({
      severity: 'notice',
      title: feelsTitle,
      description: isRu
        ? `По ощущениям ${feelsText} из-за ветра и влажности.`
        : `Wind and humidity shift perceived temperature to ${feelsText}.`,
    });
  }

  const maxWind = findMaxWind(current.windSpeed, next24, false);
  const windTitle = isRu
    ? `Ветер ${Math.round(current.windSpeed)} м/с · порывы ${Math.round(current.windGusts)} м/с`
    : `Wind ${Math.round(current.windSpeed)} m/s · gusts ${Math.round(current.windGusts)} m/s`;

  let windDesc;
  if (maxWind >= 10) {
    windDesc = isRu
      ? 'Ветреная погода — учитывайте порывы при поездках.'
      : 'Gusty conditions ahead — plan outdoor activities accordingly.';
  } else {
    windDesc = isRu ? 'Спокойная ветровая обстановка в течение суток.' : 'Calm to moderate breeze through the day.';
  }

  insights.push({
    severity: maxWind >= 10 ? 'alert' : 'info',
    title: windTitle,
    description: windDesc,
  });

  return insights.slice(0, 4);
}
