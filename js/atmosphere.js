const SVG_NS = 'http://www.w3.org/2000/svg';

// Подбираем количество частиц для текущей погоды
function getParticleCount(mood) {
  if (mood === 'rain' || mood === 'storm') return 85;
  if (mood === 'snow') return 65;
  if (mood === 'fog' || mood === 'cloudy') return 22;
  return 40;
}

// Создаём одну частицу для анимации на фоне
function createOneParticle(state, width, height) {
  const windBias = Math.min(4, state.windSpeed / 3.5);

  if (state.mood === 'rain' || state.mood === 'storm') {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 1.2 + windBias,
      vy: 11 + Math.random() * 5,
      size: 12 + Math.random() * 14,
      alpha: 0.14 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
    };
  }

  if (state.mood === 'snow') {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.3) * 0.8 + windBias * 0.25,
      vy: 1.0 + Math.random() * 1.4,
      size: 1.6 + Math.random() * 2.8,
      alpha: 0.25 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
    };
  }

  if (state.mood === 'fog' || state.mood === 'cloudy') {
    return {
      x: Math.random() * width,
      y: Math.random() * height * 0.8,
      vx: 0.25 + Math.random() * 0.35 + windBias * 0.08,
      vy: 0,
      size: 120 + Math.random() * 170,
      alpha: 0.03 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
    };
  }

  // Звёзды и лёгкие огоньки для ясной погоды
  return {
    x: Math.random() * width,
    y: Math.random() * height * 0.75,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.12,
    size: state.dayPhase === 'night' ? 1 + Math.random() * 1.6 : 1.5 + Math.random() * 2.2,
    alpha: 0.18 + Math.random() * 0.38,
    phase: Math.random() * Math.PI * 2,
  };
}

// Анимация осадков, облаков и звёзд на холсте
export function startWeatherCanvas(canvas) {
  let state = {mood: 'clear', dayPhase: 'night', windSpeed: 2, theme: 'dark'};
  let particles = [];
  let animId = 0;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let flash = 0;
  let nextFlash = performance.now() + 4500;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ctx || reducedMotion) {
    return {update() {}, destroy() {}};
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    const count = getParticleCount(state.mood);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(createOneParticle(state, width, height));
    }
  }

  function tick(now) {
    ctx.clearRect(0, 0, width, height);
    const isLight = state.theme === 'light';

    // Вспышки молний во время грозы
    if (state.mood === 'storm') {
      if (now > nextFlash) {
        flash = 0.15;
        nextFlash = now + 4500 + Math.random() * 6000;
      }
      if (flash > 0.005) {
        ctx.fillStyle = `rgba(184, 61, 255, ${flash})`;
        ctx.fillRect(0, 0, width, height);
        flash *= 0.88;
      }
    }

    for (const p of particles) {
      p.phase += 0.02;

      if (state.mood === 'rain' || state.mood === 'storm') {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > height) {
          p.y = -p.size;
          p.x = Math.random() * width;
        }
        if (p.x > width) p.x -= width;

        ctx.strokeStyle = isLight ? `rgba(59,130,246,${p.alpha * 1.1})` : `rgba(147,197,253,${p.alpha})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 1.1, p.y + p.size);
        ctx.stroke();
      } else if (state.mood === 'snow') {
        p.x += p.vx + Math.sin(p.phase) * 0.4;
        p.y += p.vy;
        if (p.y > height) {
          p.y = -8;
          p.x = Math.random() * width;
        }
        if (p.x > width) p.x -= width;
        if (p.x < 0) p.x += width;

        ctx.fillStyle = isLight ? `rgba(100,116,139,${p.alpha * 0.7})` : `rgba(244,244,248,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (state.mood === 'fog' || state.mood === 'cloudy') {
        p.x += p.vx;
        if (p.x - p.size > width) p.x = -p.size;

        const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.size);
        const rgb = isLight ? '100,116,139' : '185,195,225';
        grad.addColorStop(0, `rgba(${rgb},${p.alpha})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height * 0.75;
        if (p.y > height * 0.75) p.y = 0;

        const twinkle = p.alpha * (0.65 + 0.35 * Math.sin(p.phase * 1.4));
        if (isLight) {
          ctx.fillStyle = `rgba(225,29,72,${twinkle * 0.34})`;
        } else if (state.dayPhase === 'night') {
          ctx.fillStyle = `rgba(255,241,242,${twinkle})`;
        } else {
          ctx.fillStyle = `rgba(253,164,175,${twinkle * 0.45})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    animId = window.requestAnimationFrame(tick);
  }

  resize();
  seedParticles();
  window.addEventListener('resize', resize);
  animId = window.requestAnimationFrame(tick);

  return {
    update(next) {
      const changed =
        next.mood !== state.mood || next.dayPhase !== state.dayPhase || Math.abs(next.windSpeed - state.windSpeed) > 2;
      state = {...state, ...next};
      if (changed) seedParticles();
    },
    destroy() {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    },
  };
}

// Строим плавную кривую графика по точкам
function buildSmoothPath(coords) {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

// Мини-график температуры (SVG)
export function createSparkline({title, points, unitSuffix = '°', height = 78, showSecondary = false}) {
  const wrap = document.createElement('div');
  wrap.className = 'sparkline-wrap';
  if (!points || points.length < 2) return wrap;

  const allVals = [];
  for (const p of points) {
    allVals.push(p.value);
    if (showSecondary && typeof p.secondaryValue === 'number') {
      allVals.push(p.secondaryValue);
    }
  }

  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(1, maxVal - minVal);
  const width = 560;
  const padX = 12;
  const padY = 14;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  function toCoords(vals) {
    const coords = [];
    for (let idx = 0; idx < vals.length; idx++) {
      coords.push({
        x: padX + (idx / Math.max(1, vals.length - 1)) * plotW,
        y: padY + (1 - (vals[idx] - minVal) / range) * plotH,
      });
    }
    return coords;
  }

  const primaryCoords = toCoords(points.map((p) => p.value));
  const primaryPath = buildSmoothPath(primaryCoords);
  const lastX = primaryCoords[primaryCoords.length - 1].x.toFixed(1);
  const firstX = primaryCoords[0].x.toFixed(1);
  const bottomY = (height - 2).toFixed(1);
  const areaPath = `${primaryPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  const secondaryPath = showSecondary
    ? buildSmoothPath(toCoords(points.map((p) => p.secondaryValue ?? p.value)))
    : '';

  const header = document.createElement('div');
  header.className = 'sparkline-head';
  const titleEl = document.createElement('span');
  titleEl.className = 'sparkline-title';
  titleEl.textContent = title;
  const readoutEl = document.createElement('span');
  readoutEl.className = 'sparkline-readout mono';
  const defaultReadout = `${Math.round(minVal)}${unitSuffix} – ${Math.round(maxVal)}${unitSuffix}`;
  readoutEl.textContent = defaultReadout;
  header.append(titleEl, readoutEl);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sparkline-svg');
  svg.style.height = `${height}px`;

  const uid = `sp-${Math.random().toString(36).slice(2, 8)}`;
  const defs = document.createElementNS(SVG_NS, 'defs');
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', uid);
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');

  const stops = [
    {offset: '0%', color: 'var(--spark-max, var(--pink))', opacity: '0.22'},
    {offset: '58%', color: 'var(--spark-min, var(--blue))', opacity: '0.07'},
    {offset: '100%', color: 'var(--spark-min, var(--blue))', opacity: '0'},
  ];
  for (const s of stops) {
    const stopEl = document.createElementNS(SVG_NS, 'stop');
    stopEl.setAttribute('offset', s.offset);
    stopEl.setAttribute('stop-color', s.color);
    stopEl.setAttribute('stop-opacity', s.opacity);
    grad.appendChild(stopEl);
  }
  defs.appendChild(grad);
  svg.appendChild(defs);

  const area = document.createElementNS(SVG_NS, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', `url(#${uid})`);
  svg.appendChild(area);

  if (secondaryPath) {
    const sec = document.createElementNS(SVG_NS, 'path');
    sec.setAttribute('d', secondaryPath);
    sec.setAttribute('fill', 'none');
    sec.setAttribute('stroke', 'var(--spark-min, var(--blue))');
    sec.setAttribute('stroke-width', '2');
    sec.setAttribute('stroke-dasharray', '5 4');
    sec.setAttribute('stroke-linecap', 'round');
    sec.setAttribute('opacity', '0.9');
    svg.appendChild(sec);
  }

  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('d', primaryPath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--spark-max, var(--pink))');
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  const guide = document.createElementNS(SVG_NS, 'line');
  guide.setAttribute('y1', String(padY / 2));
  guide.setAttribute('y2', String(height - 2));
  guide.setAttribute('stroke', 'var(--line-strong)');
  guide.setAttribute('stroke-dasharray', '3 3');
  guide.style.display = 'none';

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '4.5');
  dot.setAttribute('fill', 'var(--surface)');
  dot.setAttribute('stroke', 'var(--spark-max, var(--pink))');
  dot.setAttribute('stroke-width', '2.5');
  dot.style.display = 'none';
  svg.append(guide, dot);

  // Зоны наведения для подсказки значения по дням/часам
  const sliceW = plotW / points.length;
  for (let idx = 0; idx < primaryCoords.length; idx++) {
    const coord = primaryCoords[idx];
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(Math.max(0, coord.x - sliceW / 2)));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(sliceW));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', 'transparent');
    rect.addEventListener('mouseenter', () => {
      const p = points[idx];
      if (showSecondary && typeof p.secondaryValue === 'number') {
        readoutEl.textContent = `${p.label} · ${Math.round(p.value)}${unitSuffix} / ${Math.round(p.secondaryValue)}${unitSuffix}`;
      } else {
        readoutEl.textContent = `${p.label} · ${Math.round(p.value)}${unitSuffix}`;
      }
      readoutEl.style.color = 'var(--pink)';
      guide.setAttribute('x1', String(coord.x));
      guide.setAttribute('x2', String(coord.x));
      guide.style.display = '';
      dot.setAttribute('cx', String(coord.x));
      dot.setAttribute('cy', String(coord.y));
      dot.style.display = '';
    });
    svg.appendChild(rect);
  }

  svg.addEventListener('mouseleave', () => {
    readoutEl.textContent = defaultReadout;
    readoutEl.style.color = '';
    guide.style.display = 'none';
    dot.style.display = 'none';
  });

  wrap.append(header, svg);
  return wrap;
}
