const STORAGE_LANG_KEY = 'aeriq_lang_v4';

const DICTIONARY = {
  ru: {
    nav: {
      home: 'Главная',
      forecast: 'Расширенный прогноз',
      map: 'Карта',
      favorites: 'Избранное',
      homeShort: 'Главная',
      forecastShort: 'Прогноз',
      mapShort: 'Карта',
      favoritesShort: 'Избранное',
    },
    search: {
      placeholder: 'Поиск города (например: Бишкек, Tokyo)...',
      empty: 'Города не найдены',
      error: 'Ошибка поиска города',
    },
    controls: {
      lang: 'Язык',
      unit: 'Ед.',
    },
    sparkline: {
      tempTrend: 'Тренд 24 ч',
      highsTrend: 'Максимумы',
    },
    actions: {
      saveCity: 'В избранное',
      savedCity: 'В избранном',
      open16Days: '16 дней →',
      openMap: 'Открыть карту',
      openCity: 'Открыть',
      remove: 'Удалить',
    },
    hero: {
      localTime: 'Местное время',
      feelsLike: 'Ощущается как',
      max: 'Макс',
      min: 'Мин',
    },
    sections: {
      insights: 'Weather Insights',
      metrics: 'Погодные показатели',
      daylight: 'Восход и закат',
      hourly: 'Почасовой прогноз (24 ч)',
      shortForecast: 'Прогноз на 8 дней',
      mapPreviewTitle: 'Погодная карта',
      mapPreviewDesc: 'Интерактивные слои температуры, осадков, ветра и облачности на базе Open-Meteo.',
    },
    metrics: {
      humidity: 'Влажность',
      wind: 'Скорость ветра',
      pressure: 'Давление',
      visibility: 'Видимость',
      uv: 'УФ-индекс',
      dewPoint: 'Точка росы',
      noData: 'Нет данных',
    },
    daylight: {
      sunrise: 'Восход',
      sunset: 'Закат',
      durationFmt: '{h} ч {m} мин',
    },
    forecast: {
      title: 'Расширенный прогноз на 16 дней',
      subtitle: 'Выберите показатели для отображения в таблице',
      params: {
        temp: 'Температура',
        apparent: 'Ощущается',
        pop: 'Вероятность осадков',
        precip: 'Количество осадков',
        humidity: 'Влажность',
        wind: 'Скорость ветра',
        pressure: 'Давление',
        uv: 'УФ-индекс',
        cloud: 'Облачность',
      },
      dateCol: 'Дата',
    },
    map: {
      title: 'Интерактивная погодная карта',
      gridDisclaimer: 'Модельная сетка точек Open-Meteo (не спутниковый радар)',
      updating: 'Обновление сетки...',
      viewOnMap: 'На карте',
      layers: {
        temperature: 'Температура',
        precipitation: 'Осадки',
        wind: 'Ветер',
        cloud: 'Облачность',
      },
      popup: {
        temp: 'Температура',
        precip: 'Осадки',
        wind: 'Ветер',
        cloud: 'Облачность',
      },
    },
    favorites: {
      title: 'Избранные города',
      addCurrent: 'Добавить текущий город',
      empty: 'Список избранного пуст. Сохраните первый город, чтобы быстро переключаться между локациями.',
      limitReached: 'Достигнут лимит: максимум 10 городов в избранном.',
    },
    footer: {
      desc: 'Погодный веб-сервис реального времени',
    },
    errors: {
      offline: 'Нет подключения к интернету. Проверьте сеть и попробуйте снова.',
      weatherFailed: 'Не удалось загрузить погодные данные из Open-Meteo.',
      offlineCached: 'Офлайн-режим: показаны сохранённые данные от {time}.',
    },
    weatherCodes: {
      0: 'Ясно',
      1: 'Преимущественно ясно',
      2: 'Переменная облачность',
      3: 'Пасмурно',
      45: 'Туман',
      48: 'Изморозь',
      51: 'Лёгкая морось',
      53: 'Умеренная морось',
      55: 'Сильная морось',
      61: 'Небольшой дождь',
      63: 'Умеренный дождь',
      65: 'Сильный дождь',
      66: 'Ледяной дождь',
      67: 'Сильный ледяной дождь',
      71: 'Небольшой снег',
      73: 'Умеренный снег',
      75: 'Сильный снег',
      77: 'Снежные зёрна',
      80: 'Небольшой ливень',
      81: 'Ливень',
      82: 'Сильный ливень',
      85: 'Снегопад',
      86: 'Сильный снегопад',
      95: 'Гроза',
      96: 'Гроза с градом',
      99: 'Сильная гроза с градом',
      unknown: 'Нет данных',
    },
    insights: {
      precipNow: 'Сейчас или в ближайший час ожидаются осадки — стоит взять зонт.',
      strongWind: 'Высокая скорость ветра ({wind} км/ч) — учитывайте порывы на открытых участках.',
      highUv: 'Высокий УФ-индекс ({uv}) — рекомендуется защита от солнца.',
      lowHumidity: 'Низкая влажность ({humidity}%) — воздух достаточно сухой, пейте больше воды.',
      highHumidity: 'Повышенная влажность ({humidity}%) — воздух ощущается более тяжёлым.',
      freezing: 'Температура ниже нуля ({temp}) — возможна гололедица.',
      comfortable: 'Спокойные метеоусловия без резких погодных факторов.',
    },
  },
  en: {
    nav: {
      home: 'Home',
      forecast: 'Extended Forecast',
      map: 'Map',
      favorites: 'Favorites',
      homeShort: 'Home',
      forecastShort: 'Forecast',
      mapShort: 'Map',
      favoritesShort: 'Saved',
    },
    search: {
      placeholder: 'Search city (e.g. Bishkek, Tokyo)...',
      empty: 'No cities found',
      error: 'City search failed',
    },
    controls: {
      lang: 'Lang',
      unit: 'Unit',
    },
    sparkline: {
      tempTrend: '24h trend',
      highsTrend: 'Highs trend',
    },
    actions: {
      saveCity: 'Save city',
      savedCity: 'Saved',
      open16Days: '16 days →',
      openMap: 'Open map',
      openCity: 'Open',
      remove: 'Remove',
    },
    hero: {
      localTime: 'Local time',
      feelsLike: 'Feels like',
      max: 'Max',
      min: 'Min',
    },
    sections: {
      insights: 'Weather Insights',
      metrics: 'Weather Metrics',
      daylight: 'Sunrise & Sunset',
      hourly: 'Hourly Forecast (24h)',
      shortForecast: '8-Day Forecast',
      mapPreviewTitle: 'Weather Map',
      mapPreviewDesc: 'Interactive temperature, precipitation, wind, and cloud cover layers powered by Open-Meteo.',
    },
    metrics: {
      humidity: 'Humidity',
      wind: 'Wind Speed',
      pressure: 'Pressure',
      visibility: 'Visibility',
      uv: 'UV Index',
      dewPoint: 'Dew Point',
      noData: 'No data',
    },
    daylight: {
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      durationFmt: '{h}h {m}m',
    },
    forecast: {
      title: '16-Day Extended Forecast',
      subtitle: 'Toggle meteorological parameters to customize the table',
      params: {
        temp: 'Temperature',
        apparent: 'Feels Like',
        pop: 'Precip. Probability',
        precip: 'Precipitation',
        humidity: 'Humidity',
        wind: 'Wind Speed',
        pressure: 'Pressure',
        uv: 'UV Index',
        cloud: 'Cloud Cover',
      },
      dateCol: 'Date',
    },
    map: {
      title: 'Interactive Weather Map',
      gridDisclaimer: 'Open-Meteo model grid points (not a live satellite radar)',
      updating: 'Updating grid...',
      viewOnMap: 'View on map',
      layers: {
        temperature: 'Temperature',
        precipitation: 'Precipitation',
        wind: 'Wind',
        cloud: 'Cloud Cover',
      },
      popup: {
        temp: 'Temperature',
        precip: 'Precipitation',
        wind: 'Wind',
        cloud: 'Cloud Cover',
      },
    },
    favorites: {
      title: 'Saved Cities',
      addCurrent: 'Save current city',
      empty: 'No saved cities yet. Add your first city for quick switching.',
      limitReached: 'Limit reached: maximum 10 saved cities.',
    },
    footer: {
      desc: 'Real-time weather web application',
    },
    errors: {
      offline: 'No internet connection. Check your network and try again.',
      weatherFailed: 'Failed to load weather data from Open-Meteo.',
      offlineCached: 'Offline mode: showing cached data from {time}.',
    },
    weatherCodes: {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
      unknown: 'No data',
    },
    insights: {
      precipNow: 'Precipitation is active or expected soon — consider taking an umbrella.',
      strongWind: 'High wind speed ({wind} km/h) — watch out for gusts in open areas.',
      highUv: 'High UV index ({uv}) — sun protection is recommended.',
      lowHumidity: 'Low humidity ({humidity}%) — the air is fairly dry, stay hydrated.',
      highHumidity: 'Elevated humidity ({humidity}%) — air may feel heavier.',
      freezing: 'Sub-zero temperature ({temp}) — watch for icy surfaces.',
      comfortable: 'Calm weather conditions with no severe hazards detected.',
    },
  },
};

let currentLang = localStorage.getItem(STORAGE_LANG_KEY) === 'en' ? 'en' : 'ru';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'ru';
  localStorage.setItem(STORAGE_LANG_KEY, currentLang);
  document.documentElement.lang = currentLang;
  applyStaticTranslations();
  return currentLang;
}

export function t(path, vars = {}) {
  const parts = path.split('.');
  let node = DICTIONARY[currentLang];
  for (const key of parts) {
    if (node && Object.prototype.hasOwnProperty.call(node, key)) {
      node = node[key];
    } else {
      return path;
    }
  }
  if (typeof node !== 'string') return path;
  return node.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function getWeatherDescription(code) {
  const dict = DICTIONARY[currentLang].weatherCodes;
  return dict[code] ?? dict.unknown;
}

export function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  const langTagEl = document.querySelector('#langBtnHeader .header-toggle__tag');
  if (langTagEl) langTagEl.textContent = t('controls.lang');

  const unitTagEl = document.querySelector('#unitBtnHeader .header-toggle__tag');
  if (unitTagEl) unitTagEl.textContent = t('controls.unit');

  const searchInput = document.getElementById('citySearchInput');
  if (searchInput) {
    searchInput.placeholder = t('search.placeholder');
  }
}

/**
 * Rule-based deterministic Weather Insights based strictly on real API numbers.
 */
export function buildWeatherInsights(weather, unit = 'c') {
  const lang = getLang();
  const c = weather.current;
  const today = weather.days?.[0];
  const next24 = weather.next24 || [];
  const list = [];

  const fmt = (valC) => {
    if (typeof valC !== 'number') return '—';
    const v = unit === 'f' ? (valC * 9) / 5 + 32 : valC;
    return `${Math.round(v)}°`;
  };

  if (typeof c.temperatureC === 'number' && typeof c.apparentTemperatureC === 'number') {
    const diff = c.apparentTemperatureC - c.temperatureC;
    if (Math.abs(diff) >= 2.5) {
      list.push({
        tone: diff < 0 ? 'blue' : 'pink',
        text:
          lang === 'en'
            ? diff < 0
              ? `Feels cooler (${fmt(c.apparentTemperatureC)}) than air temp (${fmt(c.temperatureC)}) — dress warmer.`
              : `Feels warmer (${fmt(c.apparentTemperatureC)}) than air temp (${fmt(c.temperatureC)}) — lighter layers work.`
            : diff < 0
              ? `Ощущается холоднее (${fmt(c.apparentTemperatureC)}), чем на термометре (${fmt(c.temperatureC)}) — лучше одеться теплее.`
              : `Ощущается теплее (${fmt(c.apparentTemperatureC)}), чем фактические ${fmt(c.temperatureC)} — можно одеться легче.`,
      });
    } else {
      list.push({
        tone: 'blue',
        text:
          lang === 'en'
            ? `Feels close to actual (${fmt(c.apparentTemperatureC)}) with balanced comfort.`
            : `Ощущения близки к фактическим (${fmt(c.apparentTemperatureC)}) — без резкого дискомфорта по теплу.`,
      });
    }
  }

  if (typeof c.windSpeedKmh === 'number') {
    const w = Math.round(c.windSpeedKmh);
    if (w >= 28) {
      list.push({
        tone: 'purple',
        text:
          lang === 'en'
            ? `Brisk wind up to ${w} km/h — expect headwind resistance and gusts.`
            : `Порывистый ветер до ${w} км/ч — на открытых участках будет ощутимое сопротивление.`,
      });
    } else if (w >= 14) {
      list.push({
        tone: 'purple',
        text:
          lang === 'en'
            ? `Moderate breeze (${w} km/h) — noticeable on open roads.`
            : `Умеренный ветер (${w} км/ч) — заметен на открытых участках и проспектах.`,
      });
    } else {
      list.push({
        tone: 'purple',
        text:
          lang === 'en'
            ? `Calm wind (${w} km/h) — favorable for outdoor movement.`
            : `Спокойный ветер (${w} км/ч) — комфортные условия для прогулок и поездок.`,
      });
    }
  }

  const maxPop = next24.reduce((acc, h) => Math.max(acc, h.precipitationProbability ?? 0), 0);
  if (maxPop >= 50) {
    list.push({
      tone: 'pink',
      text:
        lang === 'en'
          ? `Rain/snow risk up to ${maxPop}% in the next 24h — keep a shell or umbrella handy.`
          : `Вероятность осадков в ближайшие 24 ч до ${maxPop}% — возьмите защиту от дождя или снега.`,
    });
  } else {
    list.push({
      tone: 'pink',
      text:
        lang === 'en'
          ? `Low precipitation chance (${maxPop}%) over the next 24 hours — dry pavement likely.`
          : `Низкий риск осадков (${maxPop}%) на ближайшие сутки — дорожное покрытие останется сухим.`,
    });
  }

  if (today && typeof today.tempMaxC === 'number' && typeof today.tempMinC === 'number') {
    const spreadC = Math.abs(today.tempMaxC - today.tempMinC);
    const spreadDisp = unit === 'f' ? Math.round((spreadC * 9) / 5) : Math.round(spreadC);
    const unitSym = unit === 'f' ? '°F' : '°C';
    if (spreadC >= 8) {
      list.push({
        tone: 'red',
        text:
          lang === 'en'
            ? `Wide daily swing of ${spreadDisp}${unitSym} (${fmt(today.tempMinC)} to ${fmt(today.tempMaxC)}) — plan evening layers.`
            : `Перепад за день ${spreadDisp}${unitSym} (от ${fmt(today.tempMinC)} до ${fmt(today.tempMaxC)}) — к вечеру заметно похолодает.`,
      });
    }
  }

  return list.slice(0, 4);
}
