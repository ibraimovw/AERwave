const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 10 * 60 * 1000;

const weatherCache = new Map();

export async function searchCities(query, lang = 'ru', signal) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', lang === 'en' ? 'en' : 'ru');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Geocoding HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.results)) return [];

  return data.results.map((item) => ({
    id: item.id ?? `${item.latitude}_${item.longitude}`,
    name: item.name,
    admin1: item.admin1 ?? '',
    country: item.country ?? '',
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    timezone: item.timezone || 'auto',
  }));
}

export async function fetchWeatherBundle(city, signal) {
  const key = `${city.latitude.toFixed(3)}_${city.longitude.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(city.latitude));
  url.searchParams.set('longitude', String(city.longitude));
  url.searchParams.set('timezone', city.timezone || 'auto');
  url.searchParams.set('forecast_days', '16');
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'surface_pressure',
      'is_day',
    ].join(',')
  );
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'apparent_temperature',
      'precipitation_probability',
      'precipitation',
      'relative_humidity_2m',
      'dew_point_2m',
      'weather_code',
      'surface_pressure',
      'cloud_cover',
      'visibility',
      'wind_speed_10m',
      'uv_index',
    ].join(',')
  );
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(',')
  );

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Forecast HTTP ${response.status}`);
  }

  const raw = await response.json();
  if (!raw || !raw.current || !raw.hourly || !raw.daily) {
    throw new Error('Invalid weather API response');
  }

  const normalized = normalizePayload(raw);
  weatherCache.set(key, { timestamp: Date.now(), data: normalized });
  return normalized;
}

function normalizePayload(raw) {
  const hourlyTimes = Array.isArray(raw.hourly.time) ? raw.hourly.time : [];
  const currentIso = typeof raw.current.time === 'string' ? raw.current.time : '';
  const currentHourPrefix = currentIso.slice(0, 13);
  const foundIdx = hourlyTimes.findIndex((t) => typeof t === 'string' && t.startsWith(currentHourPrefix));
  const nowIdx = foundIdx >= 0 ? foundIdx : 0;

  const visMeters = raw.hourly.visibility?.[nowIdx];
  const visibilityKm =
    typeof visMeters === 'number' && Number.isFinite(visMeters)
      ? Number((visMeters / 1000).toFixed(1))
      : null;

  const dewPointC =
    typeof raw.hourly.dew_point_2m?.[nowIdx] === 'number' ? raw.hourly.dew_point_2m[nowIdx] : null;

  const uvIndex =
    typeof raw.hourly.uv_index?.[nowIdx] === 'number' ? raw.hourly.uv_index[nowIdx] : null;

  // Build 24h slice starting from current hour
  const next24 = [];
  for (let i = nowIdx; i < Math.min(nowIdx + 24, hourlyTimes.length); i++) {
    next24.push({
      time: hourlyTimes[i],
      isNow: i === nowIdx,
      temperatureC: raw.hourly.temperature_2m?.[i] ?? null,
      weatherCode: raw.hourly.weather_code?.[i] ?? null,
      precipitationProbability: raw.hourly.precipitation_probability?.[i] ?? null,
    });
  }

  // Aggregate daily averages for hourly-only metrics (humidity, pressure, cloud cover)
  const dailyTimes = Array.isArray(raw.daily.time) ? raw.daily.time : [];
  const days = dailyTimes.map((dateStr, dIdx) => {
    const startH = dIdx * 24;
    const endH = startH + 24;
    const avg = (arr) => {
      if (!Array.isArray(arr)) return null;
      const slice = arr.slice(startH, endH).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (!slice.length) return null;
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    };

    return {
      date: dateStr,
      weatherCode: raw.daily.weather_code?.[dIdx] ?? null,
      tempMaxC: raw.daily.temperature_2m_max?.[dIdx] ?? null,
      tempMinC: raw.daily.temperature_2m_min?.[dIdx] ?? null,
      apparentMaxC: raw.daily.apparent_temperature_max?.[dIdx] ?? null,
      apparentMinC: raw.daily.apparent_temperature_min?.[dIdx] ?? null,
      sunrise: raw.daily.sunrise?.[dIdx] ?? null,
      sunset: raw.daily.sunset?.[dIdx] ?? null,
      uvMax: raw.daily.uv_index_max?.[dIdx] ?? null,
      precipSumMm: raw.daily.precipitation_sum?.[dIdx] ?? null,
      precipProbMax: raw.daily.precipitation_probability_max?.[dIdx] ?? null,
      windMaxKmh: raw.daily.wind_speed_10m_max?.[dIdx] ?? null,
      humidityAvg: avg(raw.hourly.relative_humidity_2m),
      pressureAvg: avg(raw.hourly.surface_pressure),
      cloudAvg: avg(raw.hourly.cloud_cover),
    };
  });

  return {
    timezone: raw.timezone || 'UTC',
    current: {
      time: currentIso,
      isDay: raw.current.is_day === 1,
      temperatureC: raw.current.temperature_2m ?? null,
      apparentTemperatureC: raw.current.apparent_temperature ?? null,
      humidity: raw.current.relative_humidity_2m ?? null,
      weatherCode: raw.current.weather_code ?? null,
      windSpeedKmh: raw.current.wind_speed_10m ?? null,
      pressureHpa: raw.current.surface_pressure ?? null,
      visibilityKm,
      dewPointC,
      uvIndex,
    },
    next24,
    days,
  };
}

export function convertTemp(tempC, unit = 'c') {
  if (typeof tempC !== 'number' || !Number.isFinite(tempC)) return null;
  return unit === 'f' ? (tempC * 9) / 5 + 32 : tempC;
}

export function formatTemp(tempC, unit = 'c') {
  const val = convertTemp(tempC, unit);
  if (val === null) return '—';
  return `${Math.round(val)}°`;
}

export function getWeatherSvg(code) {
  if (code === 0 || code === 1) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#FF4566" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  }
  if (code === 2 || code === 3 || code === 45 || code === 48) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#9B79FF" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#49BAFF" stroke-width="2"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#F4F5FA" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/></svg>`;
  }
  if (code >= 95) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#F17BD2" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#9297A8" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;
}
