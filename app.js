const CACHE_KEY = "aer_wave_cache_v1";

const i18n = {
  ru: {
    placeholder: "Поиск города...",
    wind: "Ветер",
    humidity: "Влажность",
    pressure: "Давление",
    uv: "УФ-индекс",
    feels: "Ощущается как",
    insightsTitle: "Сводка и рекомендации",
    tempTrend: "Температура (24ч)",
    precipTrend: "Осадки (24ч)",
    forecastTitle: "Прогноз на 7 дней",
    mapTitle: "Карта локации",
    kmh: "км/ч",
    hpa: "гПа",
    notFound: "Город не найден",
    codes: {
      0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность", 3: "Пасмурно",
      45: "Туман", 48: "Изморозь", 51: "Легкая морось", 53: "Морось", 55: "Сильная морось",
      61: "Небольшой дождь", 63: "Дождь", 65: "Сильный дождь",
      71: "Небольшой снег", 73: "Снег", 75: "Снегопад",
      80: "Ливень", 95: "Гроза"
    }
  },
  en: {
    placeholder: "Search city...",
    wind: "Wind",
    humidity: "Humidity",
    pressure: "Pressure",
    uv: "UV Index",
    feels: "Feels like",
    insightsTitle: "Weather Insights",
    tempTrend: "Temperature (24h)",
    precipTrend: "Precipitation (24h)",
    forecastTitle: "7-Day Forecast",
    mapTitle: "Location Map",
    kmh: "km/h",
    hpa: "hPa",
    notFound: "City not found",
    codes: {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
      61: "Slight rain", 63: "Rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Snow", 75: "Heavy snow",
      80: "Rain showers", 95: "Thunderstorm"
    }
  }
};

let state = {
  lang: localStorage.getItem("aer_lang") || "ru",
  unit: localStorage.getItem("aer_unit") || "C",
  city: { name: "Бишкек", lat: 42.8746, lon: 74.5698 },
  weather: null
};

let map, marker;

function applyTimeTheme() {
  const h = new Date().getHours();
  let period = "day";
  if (h >= 5 && h < 11) period = "morning";
  else if (h >= 11 && h < 17) period = "day";
  else if (h >= 17 && h < 22) period = "evening";
  else period = "night";
  document.body.setAttribute("data-time", period);
}

function formatTemp(c) {
  const val = state.unit === "C" ? c : (c * 9) / 5 + 32;
  return `${Math.round(val)}°`;
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView([state.city.lat, state.city.lon], 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);
  marker = L.marker([state.city.lat, state.city.lon]).addTo(map);
}

function updateMap(lat, lon) {
  if (!map) return;
  map.setView([lat, lon], 11);
  marker.setLatLng([lat, lon]);
  document.getElementById("coordsText").textContent = `${lat.toFixed(2)}° N, ${lon.toFixed(2)}° E`;
}

function drawSparkline(canvasId, values, color, fill) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 8;

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function buildInsight(cur, hourly) {
  const isRu = state.lang === "ru";
  const maxPrecip = Math.max(...hourly.precipitation_probability.slice(0, 24));
  const temp = cur.temperature_2m;
  const wind = cur.wind_speed_10m;

  let parts = [];
  if (temp <= 2) {
    parts.push(isRu ? "Холодно — одевайтесь теплее, возможен гололёд." : "Cold conditions — dress warmly and watch for ice.");
  } else if (temp >= 28) {
    parts.push(isRu ? "Жарко — пейте больше воды и избегайте прямого солнца." : "Hot weather — stay hydrated and avoid direct midday sun.");
  } else {
    parts.push(isRu ? "Комфортная температура для прогулок и поездок по городу." : "Comfortable temperature for outdoor activities and commuting.");
  }

  if (maxPrecip >= 50) {
    parts.push(isRu ? `Вероятность осадков в ближайшие 24ч до ${maxPrecip}%.` : `Precipitation chance up to ${maxPrecip}% in the next 24h.`);
  }
  if (wind >= 25) {
    parts.push(isRu ? "Ожидается порывистый ветер." : "Gusty winds expected.");
  }
  return parts.join(" ");
}

function render() {
  const dict = i18n[state.lang];
  document.getElementById("unitToggle").textContent = `°${state.unit}`;
  document.getElementById("langToggle").textContent = state.lang.toUpperCase();
  document.getElementById("cityInput").placeholder = dict.placeholder;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  if (!state.weather) return;
  const { current, hourly, daily } = state.weather;

  document.getElementById("cityName").textContent = state.city.name;
  document.getElementById("currentDate").textContent = new Date().toLocaleDateString(
    state.lang === "ru" ? "ru-RU" : "en-US",
    { weekday: "long", day: "numeric", month: "long" }
  );

  document.getElementById("currentTemp").textContent = formatTemp(current.temperature_2m);
  document.getElementById("weatherDesc").textContent = dict.codes[current.weather_code] || "—";
  document.getElementById("feelsLike").textContent = `${dict.feels} ${formatTemp(current.apparent_temperature)}`;

  document.getElementById("windVal").textContent = `${Math.round(current.wind_speed_10m)} ${dict.kmh}`;
  document.getElementById("humidityVal").textContent = `${current.relative_humidity_2m}%`;
  document.getElementById("pressureVal").textContent = `${Math.round(current.surface_pressure)} ${dict.hpa}`;
  document.getElementById("uvVal").textContent = daily.uv_index_max[0]?.toFixed(1) ?? "—";

  document.getElementById("insightText").textContent = buildInsight(current, hourly);

  const temps24 = hourly.temperature_2m.slice(0, 24);
  const precip24 = hourly.precipitation_probability.slice(0, 24);
  document.getElementById("tempRange").textContent = `${formatTemp(Math.min(...temps24))} / ${formatTemp(Math.max(...temps24))}`;
  document.getElementById("precipMax").textContent = `${Math.max(...precip24)}%`;

  drawSparkline("tempSparkline", temps24, "#ffffff", "rgba(255,255,255,0.16)");
  drawSparkline("precipSparkline", precip24, "#38bdf8", "rgba(56,189,248,0.22)");

  const list = document.getElementById("dailyList");
  list.innerHTML = "";
  daily.time.forEach((dateStr, idx) => {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString(state.lang === "ru" ? "ru-RU" : "en-US", { weekday: "short", day: "numeric" });
    const row = document.createElement("div");
    row.className = "daily-row";
    row.innerHTML = `
      <span>${dayName}</span>
      <span>${dict.codes[daily.weather_code[idx]] || ""}</span>
      <span class="daily-temps">${formatTemp(daily.temperature_2m_max[idx])}<span class="daily-min">${formatTemp(daily.temperature_2m_min[idx])}</span></span>
    `;
    list.appendChild(row);
  });

  updateMap(state.city.lat, state.city.lon);
}

async function fetchWeather(lat, lon, cityName) {
  const badge = document.getElementById("cacheBadge");
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();

    state.city = { name: cityName, lat, lon };
    state.weather = data;
    badge.hidden = true;

    localStorage.setItem(CACHE_KEY, JSON.stringify({ city: state.city, weather: data }));
    render();
  } catch (err) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      state.city = parsed.city;
      state.weather = parsed.weather;
      badge.hidden = false;
      render();
    }
  }
}

async function searchCity(query) {
  if (!query.trim()) return;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${state.lang}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const item = data.results[0];
      fetchWeather(item.latitude, item.longitude, item.name);
    } else {
      alert(i18n[state.lang].notFound);
    }
  } catch (e) {
    alert(i18n[state.lang].notFound);
  }
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  searchCity(document.getElementById("cityInput").value);
});

document.getElementById("unitToggle").addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  localStorage.setItem("aer_unit", state.unit);
  render();
});

document.getElementById("langToggle").addEventListener("click", () => {
  state.lang = state.lang === "ru" ? "en" : "ru";
  localStorage.setItem("aer_lang", state.lang);
  render();
});

applyTimeTheme();
initMap();
const initialCache = localStorage.getItem(CACHE_KEY);
if (initialCache) {
  const parsed = JSON.parse(initialCache);
  state.city = parsed.city;
  state.weather = parsed.weather;
  render();
}
fetchWeather(state.city.lat, state.city.lon, state.city.name);
