import {
  DEFAULT_CITIES,
  fetchCityPanorama,
  fetchCityWeather,
  getCachedWeather,
  getLocalizedCityDisplay,
  resolveCityLocalization,
  searchCities,
} from './api.js';
import {createSparkline, startWeatherCanvas} from './atmosphere.js';
import {
  attachSpotlight,
  computeDayPhase,
  computeMoonPhase,
  computePressureTrend,
  computeSunProgress,
  convertTempExact,
  el,
  formatDateLabel,
  formatIsoTime,
  formatTemp,
  generateHeroDailySummary,
  generateWeatherAlerts,
  generateWeatherInsights,
  getCityLocalClock,
  getNext24Hours,
  getUvCategory,
  getWeatherMood,
  getWindDirectionLabel,
} from './helpers.js';
import {TRANSLATIONS} from './i18n.js';
import {createIcon, createWeatherIcon} from './icons.js';
import {createWeatherMapView} from './map.js';

const SETTINGS_KEY = 'aerwave_vanilla_settings_v7';
const FAVORITES_KEY = 'aerwave_vanilla_favorites_v7';
const MAX_FAVORITES = 10;
const ALL_METRICS = [
  'temperature',
  'feelsLike',
  'precipProb',
  'precipSum',
  'humidity',
  'windSpeed',
  'pressure',
  'uvIndex',
  'cloudCover',
];

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        lang: p.lang === 'en' ? 'en' : 'ru',
        unit: p.unit === 'F' ? 'F' : 'C',
        theme: p.theme === 'light' ? 'light' : 'dark',
        city: p.city?.latitude ? p.city : DEFAULT_CITIES[0],
        sidebarCollapsed: Boolean(p.sidebarCollapsed),
        metrics: Array.isArray(p.metrics) && p.metrics.length ? p.metrics : ['temperature', 'precipProb', 'windSpeed', 'humidity', 'pressure'],
      };
    }
  } catch {}
  return {
    lang: 'ru',
    unit: 'C',
    theme: 'dark',
    city: DEFAULT_CITIES[0],
    sidebarCollapsed: false,
    metrics: ['temperature', 'precipProb', 'windSpeed', 'humidity', 'pressure'],
  };
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_FAVORITES);
    }
  } catch {}
  return DEFAULT_CITIES.slice(0, 3);
}

function sameCity(a, b) {
  if (a.id && b.id && a.id === b.id) return true;
  return Math.abs(a.latitude - b.latitude) < 0.04 && Math.abs(a.longitude - b.longitude) < 0.04;
}

const initial = loadSettings();
const state = {
  lang: initial.lang,
  unit: initial.unit,
  theme: initial.theme,
  city: initial.city,
  sidebarCollapsed: initial.sidebarCollapsed,
  metrics: initial.metrics,
  favorites: loadFavorites(),
  section: 'home',
  preset: 'now',
  weather: getCachedWeather(initial.city),
  cityImage: null,
  isLoading: true,
  loadError: false,
  isOnline: navigator.onLine,
  mobileMenuOpen: false,
  compareMode: false,
  compareIds: [],
  favWeatherMap: {},
  deferredPrompt: null,
  isStandalone:
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
  isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent),
};

const refs = {
  sidebar: document.getElementById('sidebar'),
  topbar: document.getElementById('topbar'),
  banners: document.getElementById('status-banners'),
  main: document.getElementById('main-content'),
  dock: document.getElementById('mobile-dock'),
  drawer: document.getElementById('mobile-drawer'),
  iosModal: document.getElementById('ios-modal'),
  scrollBtn: document.getElementById('scroll-top-btn'),
  glow: document.getElementById('cursor-glow'),
};

const canvasEngine = startWeatherCanvas(document.getElementById('weather-canvas'));
let activeMapController = null;
let weatherAbort = null;
let searchAbort = null;
let lockedScrollY = 0;

function saveSettings() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        lang: state.lang,
        unit: state.unit,
        theme: state.theme,
        city: state.city,
        sidebarCollapsed: state.sidebarCollapsed,
        metrics: state.metrics,
      })
    );
  } catch {}
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
  } catch {}
}

function syncAtmosphere() {
  const tz = state.weather?.timezone ?? state.city.timezone ?? 'UTC';
  const today = state.weather?.daily[0];
  const dayPhase = computeDayPhase(tz, today?.sunrise, today?.sunset);
  const mood = state.weather ? getWeatherMood(state.weather.current.weatherCode) : 'clear';

  document.documentElement.lang = state.lang;
  document.body.classList.toggle('light-theme', state.theme === 'light');
  document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  document.body.setAttribute('data-dayphase', dayPhase);
  document.body.setAttribute('data-weather', mood);

  canvasEngine.update({
    mood,
    dayPhase,
    windSpeed: state.weather?.current.windSpeed ?? 6,
    theme: state.theme,
  });
  return {dayPhase, mood};
}

function lockBodyScroll(lock) {
  if (lock) {
    lockedScrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  } else {
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, lockedScrollY);
  }
}

function setMobileMenu(open) {
  if (state.mobileMenuOpen === open) return;
  state.mobileMenuOpen = open;
  lockBodyScroll(open);
  renderDrawer();
}

function makeInstallButton(compact = false) {
  const t = TRANSLATIONS[state.lang];
  if (state.isStandalone) return null;
  if (state.deferredPrompt) {
    return el(
      'button',
      {
        type: 'button',
        className: 'btn-primary',
        style: compact ? {width: '40px', height: '40px', padding: '0'} : {width: '100%'},
        title: t.pwa.installBtn,
        onClick: async () => {
          await state.deferredPrompt.prompt();
          await state.deferredPrompt.userChoice;
          state.deferredPrompt = null;
          renderChrome();
        },
      },
      createIcon('download', 'sm'),
      !compact && el('span', {}, t.pwa.installShort)
    );
  }
  if (state.isIOS) {
    return el(
      'button',
      {
        type: 'button',
        className: 'btn-subtle',
        style: compact ? {width: '40px', height: '40px', padding: '0'} : {width: '100%'},
        title: t.pwa.installBtn,
        onClick: () => showIOSModal(),
      },
      createIcon('download', 'sm c-pink'),
      !compact && el('span', {}, t.pwa.installShort)
    );
  }
  return null;
}

function showIOSModal() {
  const t = TRANSLATIONS[state.lang];
  refs.iosModal.replaceChildren(
    el(
      'div',
      {className: 'glass-panel-elevated ios-card'},
      el('h3', {className: 'section-title'}, t.pwa.iosTitle),
      el('ol', {className: 'muted-sub', style: {paddingLeft: '18px', margin: '0', lineHeight: '1.6'}}, el('li', {}, t.pwa.iosStep1), el('li', {}, t.pwa.iosStep2)),
      el('button', {type: 'button', className: 'btn-primary', onClick: () => (refs.iosModal.hidden = true)}, t.pwa.close)
    )
  );
  refs.iosModal.hidden = false;
}

function renderSidebar() {
  const t = TRANSLATIONS[state.lang];
  const collapsed = state.sidebarCollapsed;
  refs.sidebar.classList.toggle('collapsed', collapsed);

  const navItems = [
    {id: 'home', label: t.nav.home, icon: 'home'},
    {id: 'forecast', label: t.nav.forecast, icon: 'forecast'},
    {id: 'map', label: t.nav.map, icon: 'map'},
    {id: 'favorites', label: t.nav.favorites, icon: 'star', count: state.favorites.length},
  ];

  const installBtn = makeInstallButton(collapsed);

  refs.sidebar.replaceChildren(
    el(
      'div',
      {className: 'sidebar-head'},
      el(
        'button',
        {type: 'button', className: 'brand-btn', onClick: () => navigate('home')},
        el('img', {src: './assets/logo.svg', alt: t.brandName, className: 'brand-logo'}),
        !collapsed &&
          el(
            'div',
            {style: {minWidth: '0'}},
            el('div', {className: 'brand-title'}, el('span', {className: 'aer-brand-mark'}, 'AER'), '.wave'),
            el('div', {className: 'brand-slogan'}, t.slogan)
          )
      ),
      !collapsed &&
        el(
          'button',
          {
            type: 'button',
            className: 'btn-icon',
            style: {width: '32px', height: '32px'},
            'aria-label': t.nav.collapseSidebar,
            onClick: () => {
              state.sidebarCollapsed = true;
              saveSettings();
              syncAtmosphere();
              renderSidebar();
            },
          },
          createIcon('collapse', 'sm')
        )
    ),
    collapsed &&
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icon',
          style: {margin: '12px auto 0', width: '38px', height: '38px'},
          'aria-label': t.nav.expandSidebar,
          onClick: () => {
            state.sidebarCollapsed = false;
            saveSettings();
            syncAtmosphere();
            renderSidebar();
          },
        },
        createIcon('expand', 'sm')
      ),
    el(
      'nav',
      {className: 'sidebar-nav'},
      navItems.map((item) =>
        el(
          'button',
          {
            type: 'button',
            className: `nav-btn ${state.section === item.id ? 'active' : ''}`,
            onClick: () => navigate(item.id),
          },
          el(
            'span',
            {className: 'nav-left'},
            createIcon(item.icon, state.section === item.id ? 'c-pink' : ''),
            !collapsed && el('span', {}, item.label)
          ),
          !collapsed && typeof item.count === 'number' && el('span', {className: 'mono muted-xs'}, String(item.count))
        )
      )
    ),
    el(
      'div',
      {className: 'sidebar-foot'},
      installBtn,
      el(
        'div',
        {className: 'version-row'},
        !collapsed && el('span', {}, t.brandName),
        el('span', {className: 'mono c-pink'}, collapsed ? 'v7' : t.version)
      )
    )
  );
}

function renderTopBar() {
  const t = TRANSLATIONS[state.lang];
  const isFav = state.favorites.some((f) => sameCity(f, state.city));

  const searchInput = el('input', {
    type: 'text',
    className: 'search-input',
    placeholder: t.topbar.searchPlaceholder,
    'aria-label': t.topbar.searchPlaceholder,
  });
  const dropdown = el('div', {className: 'search-dropdown glass-panel-elevated', hidden: true});
  const clearBtn = el(
    'button',
    {
      type: 'button',
      className: 'search-clear',
      hidden: true,
      'aria-label': 'Clear',
      onClick: () => {
        searchInput.value = '';
        clearBtn.hidden = true;
        dropdown.hidden = true;
      },
    },
    createIcon('close', 'sm')
  );

  let timer = null;
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearBtn.hidden = !searchInput.value;
    if (q.length < 2) {
      searchAbort?.abort();
      dropdown.hidden = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      searchAbort?.abort();
      searchAbort = new AbortController();
      dropdown.replaceChildren(el('div', {className: 'search-sub', style: {padding: '10px'}}, t.topbar.searching));
      dropdown.hidden = false;
      try {
        const list = await searchCities(q, state.lang, searchAbort.signal);
        if (searchAbort.signal.aborted) return;
        if (list.length === 0) {
          dropdown.replaceChildren(el('div', {className: 'search-sub', style: {padding: '10px'}}, t.topbar.noResults));
          return;
        }
        dropdown.replaceChildren(
          ...list.map((c) =>
            el(
              'button',
              {
                type: 'button',
                className: 'search-item',
                onClick: () => {
                  dropdown.hidden = true;
                  searchInput.value = '';
                  clearBtn.hidden = true;
                  selectCity(c);
                },
              },
              el(
                'div',
                {},
                el('div', {style: {fontWeight: '600'}}, c.name),
                el('div', {className: 'search-sub'}, [c.admin1, c.country].filter(Boolean).join(' · '))
              ),
              el('span', {className: 'mono muted-xs'}, `${c.latitude.toFixed(1)}°, ${c.longitude.toFixed(1)}°`)
            )
          )
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          dropdown.replaceChildren(el('div', {className: 'c-pink', style: {padding: '10px', fontSize: '12px'}}, t.topbar.searchError));
        }
      }
    }, 260);
  });

  refs.topbar.replaceChildren(
    el(
      'div',
      {className: 'topbar-left'},
      el('img', {src: './assets/logo.svg', alt: t.brandName, className: 'mobile-logo'}),
      el(
        'div',
        {className: 'search-wrap'},
        createIcon('search', 'search-icon sm'),
        searchInput,
        clearBtn,
        dropdown
      )
    ),
    el(
      'div',
      {className: 'topbar-right'},
      el(
        'button',
        {
          type: 'button',
          className: `btn-icon ${isFav ? 'fav-active' : ''}`,
          'aria-label': isFav ? t.topbar.removeFavorite : t.topbar.addFavorite,
          onClick: toggleCurrentFavorite,
        },
        createIcon('star', 'sm')
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icon desktop-only-ctrl',
          'aria-label': state.theme === 'dark' ? t.topbar.themeLight : t.topbar.themeDark,
          onClick: toggleTheme,
        },
        createIcon(state.theme === 'dark' ? 'sun' : 'moon', 'sm c-pink')
      ),
      el(
        'div',
        {className: 'seg-group desktop-only-ctrl'},
        ['ru', 'en'].map((code) =>
          el(
            'button',
            {
              type: 'button',
              className: `seg-btn ${state.lang === code ? 'active' : ''}`,
              onClick: () => setLang(code),
            },
            code.toUpperCase()
          )
        )
      ),
      el(
        'div',
        {className: 'seg-group desktop-only-ctrl'},
        ['C', 'F'].map((u) =>
          el(
            'button',
            {
              type: 'button',
              className: `seg-btn ${state.unit === u ? 'active' : ''}`,
              onClick: () => setUnit(u),
            },
            `°${u}`
          )
        )
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icon mobile-menu-trigger',
          'aria-label': t.nav.menu,
          onClick: () => setMobileMenu(true),
        },
        createIcon('menu', 'sm')
      )
    )
  );
}

function renderDock() {
  const t = TRANSLATIONS[state.lang];
  const items = [
    {id: 'home', label: t.nav.home, icon: 'home'},
    {id: 'forecast', label: t.nav.forecast, icon: 'forecast'},
    {id: 'map', label: t.nav.map, icon: 'map'},
    {id: 'favorites', label: t.nav.favorites, icon: 'star'},
  ];
  refs.dock.replaceChildren(
    ...items.map((item) =>
      el(
        'button',
        {
          type: 'button',
          className: `dock-btn ${state.section === item.id ? 'active' : ''}`,
          onClick: () => navigate(item.id),
        },
        createIcon(item.icon),
        el('span', {}, item.label)
      )
    )
  );
}

function renderDrawer() {
  const t = TRANSLATIONS[state.lang];
  if (!state.mobileMenuOpen) {
    refs.drawer.hidden = true;
    refs.drawer.setAttribute('aria-hidden', 'true');
    return;
  }
  const {dayPhase, mood} = syncAtmosphere();
  const disp = getLocalizedCityDisplay(state.city, state.lang);
  const installBtn = makeInstallButton(false);

  const items = [
    {id: 'home', label: t.nav.home, icon: 'home'},
    {id: 'forecast', label: t.nav.forecast, icon: 'forecast'},
    {id: 'map', label: t.nav.map, icon: 'map'},
    {id: 'favorites', label: t.nav.favorites, icon: 'star'},
  ];

  refs.drawer.replaceChildren(
    el(
      'div',
      {},
      el(
        'div',
        {className: 'drawer-head'},
        el(
          'div',
          {style: {display: 'flex', alignItems: 'center', gap: '10px'}},
          el('img', {src: './assets/logo.svg', alt: t.brandName, className: 'brand-logo'}),
          el(
            'div',
            {},
            el('div', {className: 'brand-title'}, el('span', {className: 'aer-brand-mark'}, 'AER'), '.wave ', el('span', {className: 'mono c-pink', style: {fontSize: '11px'}}, t.version)),
            el('div', {className: 'muted-xs'}, `${disp.name} · ${t.dayPhases[dayPhase]} · ${t.weatherMoods[mood]}`)
          )
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'btn-icon',
            'aria-label': t.pwa.close,
            onClick: () => setMobileMenu(false),
          },
          createIcon('close', 'sm')
        )
      ),
      el(
        'nav',
        {className: 'drawer-nav'},
        items.map((item) =>
          el(
            'button',
            {
              type: 'button',
              className: `drawer-link ${state.section === item.id ? 'active' : ''}`,
              onClick: () => {
                setMobileMenu(false);
                navigate(item.id);
              },
            },
            createIcon(item.icon, state.section === item.id ? 'c-pink' : 'c-muted'),
            el('span', {className: state.section === item.id ? 'aer-grad-text' : ''}, item.label)
          )
        )
      )
    ),
    el(
      'div',
      {className: 'drawer-foot'},
      el(
        'div',
        {className: 'drawer-grid'},
        el(
          'button',
          {type: 'button', className: 'btn-subtle drawer-theme-btn', onClick: toggleTheme},
          createIcon(state.theme === 'dark' ? 'sun' : 'moon', 'sm c-pink'),
          el('span', {}, state.theme === 'dark' ? t.topbar.themeLight : t.topbar.themeDark)
        ),
        el(
          'div',
          {className: 'seg-group', style: {width: '100%', height: '44px'}},
          ['ru', 'en'].map((code) =>
            el(
              'button',
              {
                type: 'button',
                className: `seg-btn ${state.lang === code ? 'active' : ''}`,
                style: {flex: '1', height: '34px'},
                onClick: () => setLang(code),
              },
              code.toUpperCase()
            )
          )
        ),
        el(
          'div',
          {className: 'seg-group', style: {width: '100%', height: '44px'}},
          ['C', 'F'].map((u) =>
            el(
              'button',
              {
                type: 'button',
                className: `seg-btn ${state.unit === u ? 'active' : ''}`,
                style: {flex: '1', height: '34px'},
                onClick: () => setUnit(u),
              },
              `°${u}`
            )
          )
        )
      ),
      installBtn
    )
  );
  refs.drawer.hidden = false;
  refs.drawer.setAttribute('aria-hidden', 'false');
}

function renderBanners() {
  const t = TRANSLATIONS[state.lang];
  refs.banners.replaceChildren();
  if (!state.isOnline) {
    refs.banners.appendChild(
      el('div', {className: 'glass-panel banner-box'}, el('span', {style: {display: 'flex', alignItems: 'center', gap: '8px'}}, createIcon('wifiOff', 'sm c-pink'), t.pwa.offlineBadge))
    );
  }
  if (state.weather?.isCached) {
    refs.banners.appendChild(
      el(
        'div',
        {className: 'glass-panel banner-box'},
        el('span', {}, `${t.cacheBanner.offlineTitle}. ${t.cacheBanner.offlineDesc}`),
        el('button', {type: 'button', className: 'btn-subtle', onClick: () => loadCity(state.city)}, t.cacheBanner.retry)
      )
    );
  }
}

function renderHomeView() {
  const t = TRANSLATIONS[state.lang];
  const w = state.weather;
  const disp = getLocalizedCityDisplay(w.city, state.lang);
  const {dayPhase} = syncAtmosphere();
  const clock = getCityLocalClock(w.timezone);
  const today = w.daily[0];
  const tomorrow = w.daily[1];
  const weekend = w.daily.filter((d) => {
    const [y, m, day] = d.date.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, day, 12)).getUTCDay();
    return dow === 0 || dow === 6;
  }).slice(0, 2);

  // HERO
  const heroBg = el('div', {className: 'hero-bg'});
  if (state.cityImage?.url) {
    const img = el('img', {src: state.cityImage.url, alt: `${disp.name} panorama`, className: 'hero-img', referrerpolicy: 'no-referrer'});
    img.addEventListener('error', () => img.remove());
    heroBg.appendChild(img);
  }
  heroBg.appendChild(el('div', {className: 'hero-scrim'}));

  const presets = ['now', 'today', 'tomorrow', 'weekend'];
  const presetBar = el(
    'div',
    {className: 'preset-bar'},
    presets.map((p) =>
      el(
        'button',
        {
          type: 'button',
          className: `preset-btn ${state.preset === p ? 'active' : ''}`,
          onClick: () => {
            state.preset = p;
            renderMain();
          },
        },
        t.home.presets[p]
      )
    )
  );

  let heroBody;
  if (state.preset === 'tomorrow' && tomorrow) {
    heroBody = el(
      'div',
      {className: 'glass-subtle card-pad row-between gap-md', style: {background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.16)'}},
      el('div', {style: {display: 'flex', alignItems: 'center', gap: '14px'}}, createWeatherIcon(tomorrow.weatherCode, true, 'xl'), el('div', {}, el('div', {className: 'muted-xs'}, `${t.home.presetTomorrowLabel} · ${formatDateLabel(tomorrow.date, state.lang, 'full')}`), el('div', {style: {fontSize: '20px', fontWeight: '700'}}, t.wmo[tomorrow.weatherCode] ?? ''))),
      el('div', {className: 'mono', style: {display: 'flex', gap: '18px'}}, el('span', {className: 'aer-grad-text', style: {fontSize: '20px', fontWeight: '700'}}, `${formatTemp(tomorrow.tempMax, state.unit)} / ${formatTemp(tomorrow.tempMin, state.unit)}`), el('span', {}, `${Math.round(tomorrow.precipProbMax)}%`), el('span', {}, `${Math.round(tomorrow.windMax)} ${t.home.units.kmh}`))
    );
  } else if (state.preset === 'weekend' && weekend.length > 0) {
    heroBody = el(
      'div',
      {className: 'grid-2'},
      weekend.map((day) =>
        el(
          'div',
          {className: 'glass-subtle card-pad row-between gap-md', style: {background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.16)'}},
          el('div', {style: {display: 'flex', alignItems: 'center', gap: '12px'}}, createWeatherIcon(day.weatherCode, true, 'lg'), el('div', {}, el('div', {className: 'muted-xs'}, formatDateLabel(day.date, state.lang, 'full')), el('div', {style: {fontWeight: '600'}}, t.wmo[day.weatherCode] ?? ''))),
          el('div', {className: 'mono', style: {textAlign: 'right'}}, el('div', {className: 'aer-grad-text', style: {fontWeight: '700'}}, `${formatTemp(day.tempMax, state.unit)} / ${formatTemp(day.tempMin, state.unit)}`), el('div', {className: 'muted-xs'}, `${Math.round(day.precipProbMax)}% · ${Math.round(day.windMax)} ${t.home.units.kmh}`))
        )
      )
    );
  } else {
    const tempVal = state.preset === 'today' && today ? today.tempMax : w.current.temperature;
    const code = state.preset === 'today' && today ? today.weatherCode : w.current.weatherCode;
    heroBody = el(
      'div',
      {className: 'row-between gap-md'},
      el(
        'div',
        {},
        el(
          'div',
          {className: 'hero-temp-row'},
          el('div', {className: 'hero-temp aer-grad-text mono'}, formatTemp(tempVal, state.unit)),
          el(
            'div',
            {},
            el('div', {className: 'hero-cond'}, createWeatherIcon(code, state.preset === 'now' ? w.current.isDay : true, 'lg'), el('span', {}, t.wmo[code] ?? '')),
            el(
              'div',
              {className: 'mono', style: {fontSize: '13px', color: '#e2e8f0', marginTop: '6px'}},
              `${t.home.feelsLike} ${formatTemp(w.current.apparentTemperature, state.unit)}` +
                (today ? ` · ${t.home.high} ${formatTemp(today.tempMax, state.unit)} / ${t.home.low} ${formatTemp(today.tempMin, state.unit)}` : '')
            )
          )
        ),
        el('p', {className: 'hero-summary'}, generateHeroDailySummary(w, state.unit, state.lang))
      ),
      state.cityImage?.sourceUrl &&
        el('a', {href: state.cityImage.sourceUrl, target: '_blank', rel: 'noreferrer', className: 'hero-credit'}, t.home.photoCredit)
    );
  }

  const hero = attachSpotlight(
    el(
      'section',
      {className: 'glass-panel aer-top-accent hero-card'},
      heroBg,
      el(
        'div',
        {className: 'hero-top'},
        el(
          'div',
          {},
          el('div', {className: 'hero-meta'}, el('span', {className: 'aer-eyebrow-line'}), createIcon('pin', 'sm c-pink'), el('span', {}, [disp.admin1, disp.country].filter(Boolean).join(', ')), '·', t.dayPhases[dayPhase]),
          el('h1', {className: 'hero-city'}, disp.name)
        ),
        el(
          'div',
          {className: 'hero-clock-box'},
          el('div', {className: 'muted-xs', style: {textTransform: 'uppercase', letterSpacing: '0.12em', color: '#cbd5e1'}}, t.home.localTime),
          el('div', {className: 'hero-clock mono'}, clock.formattedTime),
          presetBar
        )
      ),
      el('div', {className: 'hero-bottom'}, heroBody)
    )
  );

  const stack = el('div', {className: 'view-stack'}, hero);

  // ALERTS
  const alerts = generateWeatherAlerts(w, state.lang);
  if (alerts.length > 0) {
    stack.appendChild(
      el(
        'section',
        {className: 'glass-panel card-pad', style: {borderColor: 'rgba(255,45,104,0.45)'}},
        el('div', {className: 'c-pink', style: {display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px'}}, createIcon('alert', 'sm'), t.home.alertsTitle),
        el(
          'div',
          {className: 'grid-2'},
          alerts.map((a) => el('div', {className: 'glass-subtle metric-box'}, el('strong', {}, a.title), el('p', {className: 'muted-sub', style: {margin: 0}}, a.description)))
        )
      )
    );
  }

  // INSIGHTS
  const insights = generateWeatherInsights(w, state.unit, state.lang);
  stack.appendChild(
    attachSpotlight(
      el(
        'section',
        {className: 'glass-panel aer-top-accent card-pad'},
        el('div', {className: 'section-head'}, el('h2', {className: 'section-title'}, `01 · ${t.home.insightsTitle}`), el('span', {className: 'muted-xs'}, t.home.insightsSubtitle)),
        el(
          'div',
          {className: 'grid-4'},
          insights.map((ins) => {
            const cls = ins.severity === 'alert' ? 'c-pink' : ins.severity === 'notice' ? 'c-violet' : 'c-sky';
            return el('div', {className: 'glass-subtle metric-box'}, el('div', {className: cls, style: {fontWeight: '600', fontSize: '14px'}}, ins.title), el('p', {className: 'muted-sub', style: {margin: 0}}, ins.description));
          })
        )
      )
    )
  );

  // METRICS + AQI + SUN/MOON
  const trend = computePressureTrend(w);
  const sun = today ? computeSunProgress(w.timezone, today.sunrise, today.sunset) : {progress: 0.5, daylightHours: 12, daylightMinutes: 0, goldenEvening: '18:00–18:50'};
  const moon = computeMoonPhase(Date.now(), state.lang);
  const windDir = getWindDirectionLabel(w.current.windDirection, t.windDirs);
  const uvCat = getUvCategory(w.current.uvIndex, t.uvLevels);

  const metricsPanel = attachSpotlight(
    el(
      'section',
      {className: 'glass-panel card-pad'},
      el('div', {className: 'section-head'}, el('h2', {className: 'section-title'}, `02 · ${t.home.metricsTitle}`)),
      el(
        'div',
        {className: 'grid-3'},
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('droplets', 'sm c-sky'), t.home.metrics.humidity), el('div', {className: 'metric-val mono'}, `${Math.round(w.current.humidity)}%`)),
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('wind', 'sm c-blue'), t.home.metrics.wind), el('div', {}, el('div', {className: 'metric-val mono'}, `${Math.round(w.current.windSpeed)} `, el('span', {className: 'muted-xs'}, `${t.home.units.kmh} · ${windDir}`)), el('div', {className: 'muted-xs mono'}, `${t.home.metrics.gusts} ${Math.round(w.current.windGusts)} ${t.home.units.kmh}`))),
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('gauge', 'sm c-violet'), t.home.metrics.pressure), el('div', {}, el('div', {className: 'metric-val mono'}, `${Math.round(w.current.pressure)} `, el('span', {className: 'muted-xs'}, t.home.units.hpa)), el('div', {className: 'muted-xs', style: {display: 'flex', alignItems: 'center', gap: '4px'}}, createIcon(trend === 'rising' ? 'arrowUpRight' : trend === 'falling' ? 'arrowDownRight' : 'minus', `sm ${trend === 'rising' ? 'c-emerald' : trend === 'falling' ? 'c-pink' : 'c-sky'}`), t.home.pressureTrend[trend]))),
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('eye', 'sm c-sky'), t.home.metrics.visibility), el('div', {className: 'metric-val mono'}, `${(w.current.visibility / 1000).toFixed(1)} `, el('span', {className: 'muted-xs'}, t.home.units.km))),
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('sun', 'sm c-pink'), t.home.metrics.uvIndex), el('div', {className: 'metric-val mono'}, `${w.current.uvIndex.toFixed(1)} `, el('span', {className: 'muted-xs'}, uvCat))),
        el('div', {className: 'glass-subtle metric-box'}, el('div', {className: 'muted-xs', style: {display: 'flex', gap: '6px', alignItems: 'center'}}, createIcon('thermometer', 'sm c-violet'), t.home.metrics.dewPoint), el('div', {className: 'metric-val mono'}, formatTemp(w.current.dewPoint, state.unit)))
      ),
      w.airQuality &&
        el(
          'div',
          {className: 'glass-subtle aqi-row'},
          el('div', {}, el('div', {className: 'muted-xs'}, `${t.home.aqi.title} · ${t.home.aqi.european}`), el('div', {className: 'metric-val mono', style: {marginTop: '4px'}}, String(w.airQuality.europeanAqi), ' ', el('span', {className: w.airQuality.europeanAqi <= 40 ? 'c-emerald' : w.airQuality.europeanAqi <= 60 ? 'c-amber' : 'c-pink', style: {fontSize: '14px'}}, w.airQuality.europeanAqi <= 20 ? t.home.aqi.levels.good : w.airQuality.europeanAqi <= 40 ? t.home.aqi.levels.fair : w.airQuality.europeanAqi <= 60 ? t.home.aqi.levels.moderate : t.home.aqi.levels.poor))),
          el(
            'div',
            {className: 'aqi-subs mono'},
            el('div', {}, el('div', {className: 'muted-xs'}, t.home.aqi.pm25), `${w.airQuality.pm25}`),
            el('div', {}, el('div', {className: 'muted-xs'}, t.home.aqi.pm10), `${w.airQuality.pm10}`),
            el('div', {}, el('div', {className: 'muted-xs'}, t.home.aqi.no2), `${w.airQuality.no2}`),
            el('div', {}, el('div', {className: 'muted-xs'}, t.home.aqi.ozone), `${w.airQuality.ozone}`)
          )
        )
    )
  );

  const sunT = sun.progress;
  const sunX = (1 - sunT) * (1 - sunT) * 20 + 2 * (1 - sunT) * sunT * 140 + sunT * sunT * 260;
  const sunY = (1 - sunT) * (1 - sunT) * 96 + 2 * (1 - sunT) * sunT * 12 + sunT * sunT * 96;
  const sunSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sunSvg.setAttribute('viewBox', '0 0 280 118');
  sunSvg.style.width = '100%';
  sunSvg.style.height = '112px';
  sunSvg.innerHTML = `<defs><linearGradient id="vSunG" x1="20" y1="96" x2="260" y2="96" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ff2d68"/><stop offset="52%" stop-color="#b83dff"/><stop offset="100%" stop-color="#3e8cff"/></linearGradient></defs><line x1="12" y1="96" x2="268" y2="96" stroke="var(--line-strong)" stroke-dasharray="4 4"/><path d="M 20 96 Q 140 12 260 96" fill="none" stroke="var(--line)" stroke-width="2.5"/><path d="M 20 96 Q 140 12 260 96" fill="none" stroke="url(#vSunG)" stroke-width="3" stroke-dasharray="300" stroke-dashoffset="${300 - 300 * sunT}" stroke-linecap="round"/><circle cx="${sunX}" cy="${sunY}" r="7" fill="#ff2d68" stroke="var(--surface)" stroke-width="2.5"/>`;

  const sunCard = attachSpotlight(
    el(
      'section',
      {className: 'glass-panel card-pad', style: {display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px'}},
      el('div', {className: 'row-between'}, el('h2', {className: 'section-title'}, t.home.sunTitle), el('span', {className: 'mono muted-xs'}, `${sun.daylightHours}h ${String(sun.daylightMinutes).padStart(2, '0')}m`)),
      sunSvg,
      el(
        'div',
        {className: 'row-between', style: {paddingTop: '10px', borderTop: '1px solid var(--line)'}},
        el('div', {}, el('div', {className: 'muted-xs'}, t.home.sunrise), el('div', {className: 'mono', style: {fontWeight: '600'}}, today ? formatIsoTime(today.sunrise) : '--:--')),
        el('div', {style: {textAlign: 'right'}}, el('div', {className: 'muted-xs'}, t.home.sunset), el('div', {className: 'mono', style: {fontWeight: '600'}}, today ? formatIsoTime(today.sunset) : '--:--'))
      ),
      el('div', {className: 'glass-subtle row-between', style: {padding: '10px 12px', fontSize: '12px'}}, el('span', {className: 'muted-xs'}, t.home.goldenHour), el('span', {className: 'mono'}, sun.goldenEvening)),
      el('div', {className: 'glass-subtle row-between', style: {padding: '10px 12px', fontSize: '12px'}}, el('span', {className: 'muted-xs'}, t.home.moonPhase), el('span', {}, `${moon.name} · ${moon.illumination}%`))
    )
  );

  stack.appendChild(el('div', {className: 'split-12'}, metricsPanel, sunCard));

  // HOURLY 24H
  const next24 = getNext24Hours(w);
  stack.appendChild(
    attachSpotlight(
      el(
        'section',
        {className: 'glass-panel card-pad'},
        el('div', {className: 'section-head'}, el('h2', {className: 'section-title'}, `03 · ${t.home.hourlyTitle}`), el('span', {className: 'mono muted-xs'}, `${next24.length}h`)),
        createSparkline({
          title: t.home.hourlySparklineTitle,
          points: next24.map((h, i) => ({label: i === 0 ? t.home.now : formatIsoTime(h.time), value: convertTempExact(h.temperature, state.unit)})),
        }),
        el(
          'div',
          {className: 'hourly-strip'},
          next24.map((h, i) =>
            el(
              'div',
              {className: `hour-pill ${i === 0 ? 'now' : ''}`},
              el('span', {className: 'mono muted-xs'}, i === 0 ? t.home.now : formatIsoTime(h.time)),
              createWeatherIcon(h.weatherCode, h.isDay),
              el('span', {className: 'mono', style: {fontWeight: '700'}}, formatTemp(h.temperature, state.unit)),
              el('span', {className: 'mono c-sky', style: {fontSize: '11px'}}, `${Math.round(h.precipProb)}%`)
            )
          )
        )
      )
    )
  );

  // DAILY 8 + MAP PREVIEW
  const daily8 = w.daily.slice(0, 8);
  const wMin = Math.min(...daily8.map((d) => d.tempMin));
  const wMax = Math.max(...daily8.map((d) => d.tempMax));
  const span = Math.max(1, wMax - wMin);

  const dailyCard = attachSpotlight(
    el(
      'section',
      {className: 'glass-panel card-pad'},
      el(
        'div',
        {className: 'section-head'},
        el('h2', {className: 'section-title'}, `04 · ${t.home.daily8Title}`),
        el('button', {type: 'button', className: 'btn-primary', onClick: () => navigate('forecast')}, t.home.open16Days, createIcon('arrowRight', 'sm'))
      ),
      el(
        'div',
        {},
        daily8.map((d, i) => {
          const left = ((d.tempMin - wMin) / span) * 100;
          const width = Math.max(8, ((d.tempMax - d.tempMin) / span) * 100);
          return el(
            'div',
            {className: 'daily-row'},
            el('span', {style: {width: '108px', fontWeight: '600'}}, i === 0 ? t.home.today : formatDateLabel(d.date, state.lang, 'full')),
            el('span', {style: {display: 'flex', alignItems: 'center', gap: '6px', width: '64px'}}, createWeatherIcon(d.weatherCode, true, 'sm'), d.precipProbMax >= 15 ? el('span', {className: 'mono c-sky', style: {fontSize: '11px'}}, `${Math.round(d.precipProbMax)}%`) : ''),
            el('span', {className: 'mono muted-xs', style: {width: '34px', textAlign: 'right'}}, formatTemp(d.tempMin, state.unit)),
            el('div', {className: 'daily-bar-track'}, el('div', {className: 'daily-bar-fill', style: {left: `${left}%`, width: `${width}%`}})),
            el('span', {className: 'mono', style: {width: '34px', fontWeight: '700'}}, formatTemp(d.tempMax, state.unit))
          );
        })
      )
    )
  );

  const mapPreview = attachSpotlight(
    el(
      'section',
      {className: 'glass-panel card-pad', style: {display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px'}},
      el('div', {}, el('div', {className: 'row-between mb-xs'}, el('h2', {className: 'section-title'}, t.home.mapPreviewTitle), createIcon('map', 'c-pink')), el('p', {className: 'muted-sub'}, t.home.mapPreviewDesc)),
      el(
        'div',
        {className: 'map-preview-box'},
        el('div', {className: 'row-between', style: {fontSize: '12px'}}, el('span', {}, disp.name), el('span', {className: 'mono c-pink'}, `${w.city.latitude.toFixed(2)}°, ${w.city.longitude.toFixed(2)}°`)),
        el('div', {className: 'radar-center'}, el('div', {className: 'radar-ring'}), el('span', {className: 'radar-dot'})),
        el('div', {className: 'row-between mono', style: {fontSize: '11px', color: '#cbd5e1'}}, el('span', {}, `${t.map.layers.temp}: ${formatTemp(w.current.temperature, state.unit)}`), el('span', {}, `${t.map.layers.clouds}: ${Math.round(w.current.cloudCover)}%`))
      ),
      el('button', {type: 'button', className: 'btn-subtle', style: {width: '100%'}, onClick: () => navigate('map')}, t.home.openMap, createIcon('arrowRight', 'sm c-pink'))
    )
  );

  stack.appendChild(el('div', {className: 'split-12'}, dailyCard, mapPreview));
  return stack;
}

function renderForecastView() {
  const t = TRANSLATIONS[state.lang];
  const w = state.weather;
  const disp = getLocalizedCityDisplay(w.city, state.lang);

  const metricCell = (d, m) => {
    switch (m) {
      case 'temperature': return `${formatTemp(d.tempMax, state.unit)} / ${formatTemp(d.tempMin, state.unit)}`;
      case 'feelsLike': return `${formatTemp(d.feelsMax, state.unit)} / ${formatTemp(d.feelsMin, state.unit)}`;
      case 'precipProb': return `${Math.round(d.precipProbMax)}%`;
      case 'precipSum': return `${d.precipSum.toFixed(1)} ${t.home.units.mm}`;
      case 'humidity': return `${d.humidityMean}%`;
      case 'windSpeed': return `${Math.round(d.windMax)} ${t.home.units.kmh}`;
      case 'pressure': return `${d.pressureMean} ${t.home.units.hpa}`;
      case 'uvIndex': return d.uvMax.toFixed(1);
      case 'cloudCover': return `${d.cloudCoverMean}%`;
    }
  };

  return el(
    'div',
    {className: 'view-stack'},
    el(
      'section',
      {className: 'glass-panel aer-top-accent card-pad'},
      el('div', {className: 'eyebrow'}, el('span', {className: 'aer-eyebrow-line'}), el('span', {}, disp.name)),
      el('div', {className: 'row-between mb-md'}, el('div', {}, el('h1', {className: 'page-title'}, t.forecast.title), el('p', {className: 'muted-sub'}, t.forecast.subtitle)), el('span', {className: 'mono c-pink'}, `${w.daily.length}d`)),
      createSparkline({
        title: t.forecast.sparklineTitle,
        height: 92,
        showSecondary: true,
        points: w.daily.map((d, i) => ({
          label: i === 0 ? t.home.today : formatDateLabel(d.date, state.lang, 'short'),
          value: convertTempExact(d.tempMax, state.unit),
          secondaryValue: convertTempExact(d.tempMin, state.unit),
        })),
      })
    ),
    el(
      'section',
      {className: 'glass-panel card-pad'},
      el('div', {className: 'muted-xs mb-md'}, t.forecast.parametersLabel),
      el(
        'div',
        {className: 'pill-group'},
        ALL_METRICS.map((m) =>
          el(
            'button',
            {
              type: 'button',
              className: `chip-btn ${state.metrics.includes(m) ? 'active' : ''}`,
              onClick: () => {
                if (state.metrics.includes(m)) {
                  if (state.metrics.length <= 1) return;
                  state.metrics = state.metrics.filter((x) => x !== m);
                } else {
                  state.metrics = [...state.metrics, m];
                }
                saveSettings();
                renderMain();
              },
            },
            t.forecast.metrics[m]
          )
        )
      )
    ),
    el(
      'section',
      {className: 'glass-panel table-scroll'},
      el(
        'table',
        {className: 'forecast-table'},
        el('thead', {}, el('tr', {}, el('th', {}, t.forecast.dateCol), el('th', {}, t.forecast.conditionCol), state.metrics.map((m) => el('th', {}, t.forecast.metrics[m])))),
        el(
          'tbody',
          {},
          w.daily.map((d, i) =>
            el(
              'tr',
              {},
              el('td', {style: {fontWeight: '600'}}, i === 0 ? t.home.today : formatDateLabel(d.date, state.lang, 'full')),
              el('td', {}, el('span', {style: {display: 'inline-flex', alignItems: 'center', gap: '8px'}}, createWeatherIcon(d.weatherCode, true, 'sm'), t.wmo[d.weatherCode] ?? '')),
              state.metrics.map((m) => el('td', {className: 'mono'}, metricCell(d, m)))
            )
          )
        )
      )
    )
  );
}

function renderFavoritesView() {
  const t = TRANSLATIONS[state.lang];
  const stack = el(
    'div',
    {className: 'view-stack'},
    el(
      'section',
      {className: 'glass-panel aer-top-accent card-pad row-between gap-md'},
      el('div', {}, el('div', {className: 'eyebrow'}, el('span', {className: 'aer-eyebrow-line'}), t.brandName), el('h1', {className: 'page-title'}, t.favorites.title), el('p', {className: 'muted-sub'}, t.favorites.subtitle)),
      el(
        'div',
        {style: {display: 'flex', gap: '10px', alignItems: 'center'}},
        state.favorites.length >= 2 &&
          el(
            'button',
            {
              type: 'button',
              className: state.compareMode ? 'btn-primary' : 'btn-subtle',
              onClick: () => {
                state.compareMode = !state.compareMode;
                if (!state.compareMode) state.compareIds = [];
                renderMain();
              },
            },
            createIcon('compare', 'sm'),
            t.favorites.compareToggle
          ),
        el('div', {className: 'glass-subtle mono', style: {padding: '8px 14px', fontSize: '13px', fontWeight: '700'}}, el('span', {className: 'c-pink'}, String(state.favorites.length)), ` ${t.favorites.counterSuffix}`)
      )
    )
  );

  // Load weather for favorites lazily
  state.favorites.forEach((fav) => {
    if (!state.favWeatherMap[fav.id]) {
      const cached = getCachedWeather(fav);
      if (cached) state.favWeatherMap[fav.id] = cached;
      void fetchCityWeather(fav).then((data) => {
        state.favWeatherMap[fav.id] = data;
        if (state.section === 'favorites') renderMain();
      }).catch(() => {});
    }
  });

  if (state.compareMode) {
    const pair = state.compareIds
      .map((id) => ({city: state.favorites.find((c) => c.id === id), weather: state.favWeatherMap[id]}))
      .filter((x) => x.city && x.weather);

    stack.appendChild(
      el(
        'section',
        {className: 'glass-panel card-pad', style: {borderColor: 'rgba(255,45,104,0.45)'}},
        el('div', {className: 'row-between mb-md'}, el('strong', {}, pair.length === 2 ? t.favorites.compareTitle : t.favorites.compareSelectHint), state.compareIds.length > 0 && el('button', {type: 'button', className: 'c-pink', onClick: () => { state.compareIds = []; renderMain(); }}, t.favorites.clearCompare)),
        pair.length === 2 &&
          el(
            'div',
            {className: 'grid-2'},
            pair.map(({city, weather}) => {
              const disp = getLocalizedCityDisplay(city, state.lang);
              const clk = getCityLocalClock(weather.timezone);
              return el(
                'div',
                {className: 'glass-subtle metric-box'},
                el('div', {className: 'row-between'}, el('div', {}, el('strong', {style: {fontSize: '18px'}}, disp.name), el('div', {className: 'muted-xs'}, `${disp.country} · ${clk.formattedTime}`)), el('div', {className: 'aer-grad-text mono', style: {fontSize: '24px', fontWeight: '700'}}, formatTemp(weather.current.temperature, state.unit))),
                el('div', {className: 'mono muted-xs'}, `${t.home.metrics.wind}: ${Math.round(weather.current.windSpeed)} ${t.home.units.kmh} · ${t.home.metrics.humidity}: ${Math.round(weather.current.humidity)}% · ${t.home.metrics.pressure}: ${Math.round(weather.current.pressure)} ${t.home.units.hpa}`)
              );
            })
          )
      )
    );
  }

  if (state.favorites.length === 0) {
    stack.appendChild(
      el(
        'section',
        {className: 'glass-panel card-pad'},
        el('h2', {className: 'section-title'}, t.favorites.emptyTitle),
        el('p', {className: 'muted-sub mb-md'}, t.favorites.emptyDesc),
        el(
          'div',
          {className: 'pill-group'},
          DEFAULT_CITIES.map((c) =>
            el('button', {type: 'button', className: 'btn-subtle', onClick: () => { state.favorites.unshift(c); saveFavorites(); renderChrome(); renderMain(); }}, `+ ${getLocalizedCityDisplay(c, state.lang).name}`)
          )
        )
      )
    );
    return stack;
  }

  stack.appendChild(
    el(
      'div',
      {className: 'fav-grid'},
      state.favorites.map((city, idx) => {
        const disp = getLocalizedCityDisplay(city, state.lang);
        const w = state.favWeatherMap[city.id];
        const phase = w ? computeDayPhase(w.timezone, w.daily[0]?.sunrise, w.daily[0]?.sunset) : 'night';
        const clk = w ? getCityLocalClock(w.timezone) : null;
        const compared = state.compareIds.includes(city.id);

        return attachSpotlight(
          el(
            'article',
            {className: 'glass-panel aer-top-accent fav-card', style: compared ? {borderColor: 'var(--pink)'} : {}},
            el(
              'div',
              {className: 'row-between', style: {alignItems: 'flex-start'}},
              el('div', {}, el('div', {className: 'mono muted-xs'}, clk ? `${clk.formattedTime} · ${t.dayPhases[phase]}` : t.dayPhases[phase]), el('h2', {className: 'section-title', style: {marginTop: '4px'}}, disp.name), el('div', {className: 'muted-xs'}, [disp.admin1, disp.country].filter(Boolean).join(' · '))),
              w
                ? el('div', {style: {display: 'flex', alignItems: 'center', gap: '10px'}}, createWeatherIcon(w.current.weatherCode, w.current.isDay, 'lg'), el('div', {style: {textAlign: 'right'}}, el('div', {className: 'aer-grad-text mono', style: {fontSize: '24px', fontWeight: '700'}}, formatTemp(w.current.temperature, state.unit)), el('div', {className: 'muted-xs mono'}, `${formatTemp(w.daily[0]?.tempMax ?? w.current.temperature, state.unit)} / ${formatTemp(w.daily[0]?.tempMin ?? w.current.temperature, state.unit)}`)))
                : el('span', {className: 'muted-xs'}, t.favorites.loadingWeather)
            ),
            w && el('div', {className: 'muted-xs'}, t.wmo[w.current.weatherCode] ?? ''),
            el(
              'div',
              {className: 'fav-actions'},
              state.compareMode
                ? el('button', {type: 'button', className: compared ? 'btn-primary' : 'btn-subtle', onClick: () => {
                    if (compared) state.compareIds = state.compareIds.filter((x) => x !== city.id);
                    else state.compareIds = state.compareIds.length >= 2 ? [state.compareIds[1], city.id] : [...state.compareIds, city.id];
                    renderMain();
                  }}, t.favorites.compareToggle)
                : el('div', {style: {display: 'flex', gap: '8px'}},
                    el('button', {type: 'button', className: 'btn-primary', onClick: () => { selectCity(city); navigate('home'); }}, t.favorites.openCity),
                    el('button', {type: 'button', className: 'btn-subtle', onClick: () => { selectCity(city); navigate('map'); }}, t.favorites.showOnMap)
                  ),
              el(
                'div',
                {style: {display: 'flex', gap: '4px'}},
                el('button', {type: 'button', className: 'btn-icon', style: {width: '30px', height: '30px'}, disabled: idx === 0, 'aria-label': t.favorites.moveUp, onClick: () => moveFav(idx, -1)}, createIcon('arrowUp', 'sm')),
                el('button', {type: 'button', className: 'btn-icon', style: {width: '30px', height: '30px'}, disabled: idx === state.favorites.length - 1, 'aria-label': t.favorites.moveDown, onClick: () => moveFav(idx, 1)}, createIcon('arrowDown', 'sm')),
                el('button', {type: 'button', className: 'btn-icon', style: {width: '30px', height: '30px'}, 'aria-label': t.favorites.removeCity, onClick: () => { state.favorites = state.favorites.filter((f) => !sameCity(f, city)); saveFavorites(); renderChrome(); renderMain(); }}, createIcon('trash', 'sm c-pink'))
              )
            )
          )
        );
      })
    )
  );
  return stack;
}

function renderMain() {
  activeMapController?.destroy();
  activeMapController = null;
  const t = TRANSLATIONS[state.lang];

  if (state.loadError && !state.weather) {
    refs.main.replaceChildren(
      el('div', {className: 'glass-panel card-pad', style: {textAlign: 'center'}}, el('h2', {className: 'section-title'}, t.errors.loadFailedTitle), el('p', {className: 'muted-sub mb-md'}, t.errors.loadFailedDesc), el('button', {type: 'button', className: 'btn-primary', onClick: () => loadCity(state.city)}, t.errors.retry))
    );
    return;
  }

  if (!state.weather) {
    refs.main.replaceChildren(el('div', {className: 'glass-panel card-pad', style: {height: '280px'}}));
    return;
  }

  if (state.section === 'home') refs.main.replaceChildren(renderHomeView());
  else if (state.section === 'forecast') refs.main.replaceChildren(renderForecastView());
  else if (state.section === 'favorites') refs.main.replaceChildren(renderFavoritesView());
  else if (state.section === 'map') {
    const disp = getLocalizedCityDisplay(state.city, state.lang);
    activeMapController = createWeatherMapView({city: state.city, cityName: disp.name, unit: state.unit, t});
    refs.main.replaceChildren(activeMapController.el);
  }
}

function renderChrome() {
  syncAtmosphere();
  renderSidebar();
  renderTopBar();
  renderDock();
  renderBanners();
  renderDrawer();
}

function navigate(sec) {
  state.section = sec;
  renderChrome();
  renderMain();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveSettings();
  renderChrome();
}

function setLang(code) {
  state.lang = code;
  saveSettings();
  void resolveAllLocalizations();
  renderChrome();
  renderMain();
}

function setUnit(u) {
  state.unit = u;
  saveSettings();
  renderChrome();
  renderMain();
}

function toggleCurrentFavorite() {
  const exists = state.favorites.some((f) => sameCity(f, state.city));
  if (exists) state.favorites = state.favorites.filter((f) => !sameCity(f, state.city));
  else if (state.favorites.length < MAX_FAVORITES) state.favorites = [state.city, ...state.favorites];
  saveFavorites();
  renderChrome();
  if (state.section === 'favorites') renderMain();
}

function moveFav(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= state.favorites.length) return;
  const copy = [...state.favorites];
  const [moved] = copy.splice(idx, 1);
  copy.splice(target, 0, moved);
  state.favorites = copy;
  saveFavorites();
  renderMain();
}

function selectCity(city) {
  state.city = city;
  saveSettings();
  if (state.section === 'favorites') state.section = 'home';
  loadCity(city);
}

async function resolveAllLocalizations() {
  const lang = state.lang;
  if (!state.city.localized?.[lang]) {
    const updated = await resolveCityLocalization(state.city, lang).catch(() => null);
    if (updated?.localized?.[lang] && sameCity(state.city, updated)) {
      state.city = {...state.city, localized: {...state.city.localized, ...updated.localized}};
      if (state.weather) state.weather.city = state.city;
      saveSettings();
      renderChrome();
      renderMain();
    }
  }
  await Promise.allSettled(
    state.favorites.map(async (f, i) => {
      if (f.localized?.[lang]) return;
      const u = await resolveCityLocalization(f, lang);
      if (u.localized?.[lang]) state.favorites[i] = u;
    })
  );
  saveFavorites();
  if (state.section === 'favorites') renderMain();
}

function loadCity(city) {
  weatherAbort?.abort();
  weatherAbort = new AbortController();
  const signal = weatherAbort.signal;

  const cached = getCachedWeather(city);
  if (cached) state.weather = cached;
  state.isLoading = true;
  state.loadError = false;
  renderChrome();
  renderMain();

  void Promise.allSettled([fetchCityWeather(city, signal), fetchCityPanorama(city, signal)]).then(([wRes, imgRes]) => {
    if (signal.aborted) return;
    if (wRes.status === 'fulfilled') {
      state.weather = wRes.value;
      state.loadError = false;
    } else {
      const fb = getCachedWeather(city);
      state.weather = fb;
      state.loadError = !fb;
    }
    state.cityImage = imgRes.status === 'fulfilled' ? imgRes.value : null;
    state.isLoading = false;
    renderChrome();
    renderMain();
    void resolveAllLocalizations();
  });
}

// Global Listeners
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !refs.glow) return;
  refs.glow.style.left = `${e.clientX}px`;
  refs.glow.style.top = `${e.clientY}px`;
}, {passive: true});

window.addEventListener('scroll', () => {
  refs.scrollBtn.hidden = window.scrollY < 400;
}, {passive: true});
refs.scrollBtn.appendChild(createIcon('arrowUp', 'sm'));
refs.scrollBtn.addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.mobileMenuOpen) setMobileMenu(false);
});
document.addEventListener('click', (e) => {
  if (!refs.topbar.contains(e.target)) {
    const dd = refs.topbar.querySelector('.search-dropdown');
    if (dd) dd.hidden = true;
  }
});
window.addEventListener('online', () => { state.isOnline = true; renderBanners(); });
window.addEventListener('offline', () => { state.isOnline = false; renderBanners(); });
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  renderChrome();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Initial Boot
loadCity(state.city);
