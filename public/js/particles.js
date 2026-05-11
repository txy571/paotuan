// ==================== STARFIELD BACKGROUND ====================
// Multi-layer particle system simulating a realistic night sky.
//
// Layers (deepest → nearest):
//   8 — ultra-deep field dust (tiny, dense, subtle)
//   7 — very dim distant stars, barely perceptible
//   6 — dim field stars, slight twinkle
//   5 — medium-faint stars, gentle twinkle
//   4 — medium stars, visible color tint
//   3 — brighter mid-field, soft glow halos
//   2 — bright stars, prominent glow, noticeable twinkle
//   1 — very bright, large halo, strong atmospheric scintillation
//
// Perf: Stars bucketed by layer (no per-frame sort).
//       Accent color cached (60-frame TTL). Glow gradients cached by key.

let running = false;
let frameCount = 0;

// ── Stellar color temperatures (O B A F G K M) with realistic spectral hues ──
const STELLAR = [
  '#9db4ff', // O-type: blue-white
  '#a8bfff','#b0c4ff','#b8c8ff','#c0ccff', // B-type
  '#d0d8ff','#dae0ff','#e2e8ff','#e8ecff', // A-type
  '#f8f6f2','#fff8f0','#fff5eb','#fff2e5', // F-type
  '#ffeed8','#ffeacc','#ffe5c0','#ffe0b4', // G-type
  '#ffd9a5','#ffd198','#ffc888','#ffc078', // K-type
  '#ffb568','#ffaa58','#ff9f48','#ff9438','#ff8828','#ff7a18', // M-type
];

function starColor() {
  const r = Math.random();
  if (r < 0.0003) return STELLAR[0];
  if (r < 0.002)  return STELLAR[Math.floor(Math.random()*4)+1];
  if (r < 0.015)  return STELLAR[Math.floor(Math.random()*4)+5];
  if (r < 0.06)   return STELLAR[Math.floor(Math.random()*4)+9];
  if (r < 0.18)   return STELLAR[Math.floor(Math.random()*4)+13];
  if (r < 0.38)   return STELLAR[Math.floor(Math.random()*4)+17];
  return STELLAR[Math.floor(Math.random()*6)+21];
}

// ── Layer config ──
function layerCounts(cw, ch) {
  const s = Math.max(0.40, (cw * ch) / (1920 * 1080));
  return {
    8: Math.round(2500 * s),
    7: Math.round(1800 * s),
    6: Math.round(1100 * s),
    5: Math.round(600 * s),
    4: Math.round(300 * s),
    3: Math.round(120 * s),
    2: Math.round(60 * s),
    1: Math.round(30 * s),
  };
}

// ── Star clusters ──
const clusters = [];
function initClusters(w, h) {
  clusters.length = 0;
  const count = 3 + Math.floor(Math.random() * 4);
  for (let c = 0; c < count; c++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const radius = 15 + Math.random() * 60;
    const starCount = 8 + Math.floor(Math.random() * 30);
    const members = [];
    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.abs(randomGaussian()) * radius;
      members.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        size: 0.18 + Math.random() * 0.55,
        opacity: 0.04 + Math.random() * 0.12,
        color: starColor(),
        twPhase: Math.random() * Math.PI * 2,
      });
    }
    clusters.push({ cx, cy, radius, members });
  }
}

function randomGaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Milky Way density ──
function milkyWay(x, y, w, h) {
  const cx = w * 0.38, cy = h * 0.45;
  const baseAngle = 0.6;
  const wave = 0.25 * Math.sin(x * 0.0008 + y * 0.0003) + 0.15 * Math.cos(y * 0.0006);
  const angle = baseAngle + wave;
  const dx = (x - cx) / w;
  const dy = (y - cy) / h;
  const dist = Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle));
  const core = Math.exp(-dist * dist * 12);
  const halo = 0.4 * Math.exp(-dist * dist * 2.5);
  return Math.min(1, 0.45 + 0.55 * (core + halo));
}

// ── Nebulae ──
const nebulae = [];
function initNebulae(w, h) {
  nebulae.length = 0;
  for (let i = 0; i < 2; i++) {
    nebulae.push({
      x: Math.random() * w, y: Math.random() * h,
      rx: 120 + Math.random() * 280,
      ry: 60 + Math.random() * 160,
      alpha: 0.015 + Math.random() * 0.03,
      hue: [210, 280, 340, 30, 180][i],
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// ── Aurora ──
const aurora = { bands: [] };
function initAurora(w, h) {
  aurora.bands = [];
  const count = 1 + Math.floor(Math.random() * 1);
  for (let i = 0; i < count; i++) {
    aurora.bands.push({
      baseY: h * (0.12 + Math.random() * 0.25),
      amplitude: 25 + Math.random() * 60,
      frequency: 0.0008 + Math.random() * 0.002,
      speed: 0.0003 + Math.random() * 0.0008,
      phase: Math.random() * Math.PI * 2,
      hue: [140, 160, 180, 280, 300][Math.floor(Math.random() * 5)],
      thickness: 18 + Math.random() * 40,
      alpha: 0.025 + Math.random() * 0.04,
    });
  }
}

function drawAurora(ctx, w, h, frame) {
  for (const band of aurora.bands) {
    ctx.save();
    const step = 4;
    const points = [];
    for (let x = -20; x <= w + 20; x += step) {
      const wave1 = Math.sin(x * band.frequency + frame * band.speed + band.phase) * band.amplitude;
      const wave2 = Math.cos(x * band.frequency * 0.6 + frame * band.speed * 0.7 + band.phase) * band.amplitude * 0.5;
      const y = band.baseY + wave1 + wave2;
      points.push({ x, y });
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y - band.thickness);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y - band.thickness * (0.5 + 0.5 * Math.sin(i * 0.1 + frame * band.speed * 2)));
    }
    for (let i = points.length - 1; i >= 0; i--) {
      ctx.lineTo(points[i].x, points[i].y + band.thickness * (0.5 + 0.5 * Math.cos(i * 0.12 + frame * band.speed * 1.8)));
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, band.baseY - band.thickness * 2, 0, band.baseY + band.thickness * 2);
    const alpha = band.alpha * (0.7 + 0.3 * Math.sin(frame * 0.0003 + band.phase));
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.3, `hsla(${band.hue},80%,60%,${alpha})`);
    grad.addColorStop(0.5, `hsla(${band.hue},90%,65%,${alpha * 1.3})`);
    grad.addColorStop(0.7, `hsla(${band.hue},70%,55%,${alpha * 0.6})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = `hsla(${band.hue},80%,75%,${alpha * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < points.length - 1; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Moon ──
const moon = {};
function initMoon(w, h) {
  moon.x = w * (0.72 + Math.random() * 0.2);
  moon.y = h * (0.12 + Math.random() * 0.2);
  moon.radius = Math.min(w, h) * (0.04 + Math.random() * 0.03);
  moon.glowRadius = moon.radius * 4;
  moon.craters = [];
  const craterCount = 5 + Math.floor(Math.random() * 8);
  for (let i = 0; i < craterCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * moon.radius * 0.75;
    moon.craters.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      r: moon.radius * (0.08 + Math.random() * 0.18),
      alpha: 0.06 + Math.random() * 0.14,
    });
  }
}

function drawMoon(ctx, frame) {
  const { x, y, radius, glowRadius, craters } = moon;
  if (!radius) return;
  const shimmer = 1 + 0.02 * Math.sin(frame * 0.001);
  const gOuter = ctx.createRadialGradient(x, y, radius * 0.9, x, y, glowRadius * shimmer);
  gOuter.addColorStop(0, 'rgba(220,210,180,0.25)');
  gOuter.addColorStop(0.3, 'rgba(200,190,160,0.08)');
  gOuter.addColorStop(0.6, 'rgba(180,170,140,0.02)');
  gOuter.addColorStop(1, 'transparent');
  ctx.fillStyle = gOuter;
  ctx.beginPath(); ctx.arc(x, y, glowRadius * shimmer, 0, Math.PI * 2); ctx.fill();
  const gInner = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2);
  gInner.addColorStop(0, 'rgba(255,245,225,0.15)');
  gInner.addColorStop(0.5, 'rgba(240,230,210,0.05)');
  gInner.addColorStop(1, 'transparent');
  ctx.fillStyle = gInner;
  ctx.beginPath(); ctx.arc(x, y, radius * 2, 0, Math.PI * 2); ctx.fill();
  const gBody = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, radius * 0.1, x, y, radius * shimmer);
  gBody.addColorStop(0, '#faf5ea');
  gBody.addColorStop(0.4, '#f0ead8');
  gBody.addColorStop(0.75, '#d8d0b8');
  gBody.addColorStop(1, '#b8b098');
  ctx.fillStyle = gBody;
  ctx.beginPath(); ctx.arc(x, y, radius * shimmer, 0, Math.PI * 2); ctx.fill();
  const gShadow = ctx.createRadialGradient(x + radius * 0.35, y - radius * 0.1, radius * 0.2, x, y, radius * shimmer);
  gShadow.addColorStop(0, 'rgba(30,25,20,0.0)');
  gShadow.addColorStop(0.6, 'rgba(30,25,20,0.0)');
  gShadow.addColorStop(0.85, 'rgba(30,25,20,0.25)');
  gShadow.addColorStop(1, 'rgba(30,25,20,0.45)');
  ctx.fillStyle = gShadow;
  ctx.beginPath(); ctx.arc(x, y, radius * shimmer, 0, Math.PI * 2); ctx.fill();
  for (const cr of craters) {
    const cx = x + cr.x;
    const cy = y + cr.y;
    ctx.fillStyle = `rgba(180,175,160,${cr.alpha})`;
    ctx.beginPath(); ctx.arc(cx, cy, cr.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(220,215,200,${cr.alpha * 0.6})`;
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.arc(cx - cr.r * 0.1, cy - cr.r * 0.1, cr.r, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── Shooting stars ──
let shooters = [];
function spawnShooter(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h * 0.5,
    vx: (Math.random() * 3 + 4) * (Math.random() < 0.5 ? 1 : -1),
    vy: (Math.random() * 1.5 + 1.5) * (Math.random() < 0.5 ? 1 : -1),
    life: 1,
    decay: 0.006 + Math.random() * 0.015,
    len: 50 + Math.random() * 100,
  };
}

// ── Stars (bucketed by layer — no per-frame sort) ──
const starsByLayer = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[] };
let constellations = [];

function createStar(layer, cw, ch) {
  let x = Math.random() * cw, y = Math.random() * ch;
  const mw = milkyWay(x, y, cw, ch);
  if (Math.random() > mw) { x = Math.random() * cw; y = Math.random() * ch; }

  const siz = [0, 2.8, 1.8, 1.3, 0.95, 0.7, 0.5, 0.35, 0.22][layer];
  const sz = siz * (0.5 + Math.random() * 0.5);
  const op = [0, 0.72, 0.55, 0.42, 0.30, 0.20, 0.12, 0.07, 0.04][layer];
  const boost = Math.random() < 0.06 ? 1.5 : 1;

  const horizonFactor = Math.max(0.15, y / Math.max(1, ch));
  const scintAmp = 0.03 + horizonFactor * 0.10;

  const isVariable = layer <= 4 && Math.random() < 0.03;
  const varPeriod = isVariable ? 300 + Math.random() * 1200 : 0;
  const varAmp = isVariable ? 0.15 + Math.random() * 0.30 : 0;
  const varPhase = Math.random() * Math.PI * 2;

  // Increased drift velocity: layers 1-4 faster (0.08), layers 5-8 slower (0.03)
  const driftMult = layer <= 4 ? 0.08 : 0.03;
  // Constant drift component so stars visibly traverse the screen
  const driftAngle = Math.random() * Math.PI * 2;

  return {
    layer, x, y,
    size: Math.max(0.18, sz + (Math.random() - 0.5) * sz * 0.5),
    baseOpacity: op * (0.6 + Math.random() * 0.4) * boost,
    opacity: 0,
    // Constant drift + slight random jitter
    vx: Math.cos(driftAngle) * driftMult + (Math.random() - 0.5) * driftMult * 0.25,
    vy: Math.sin(driftAngle) * driftMult + (Math.random() - 0.5) * driftMult * 0.25,
    twFreq: (0.0003 + Math.random() * 0.001) * (9 - layer),
    twPhase: Math.random() * Math.PI * 2,
    twAmp: (9 - layer) * (scintAmp + Math.random() * 0.03),
    horizonFactor,
    color: starColor(),
    glow: layer <= 3,
    glowR: layer === 1 ? 5.5 : layer === 2 ? 3.5 : 2,
    isVariable, varPeriod, varAmp, varPhase,
  };
}

function makeConstellations() {
  const pool = [];
  for (let l = 4; l >= 1; l--) {
    for (const s of starsByLayer[l]) pool.push(s);
  }
  const pairs = [];
  const maxD = Math.min(window.innerWidth, window.innerHeight) * 0.22;
  const used = new Set();
  for (let i = 0; i < 7; i++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    let best = null, bestD = Infinity;
    for (let t = 0; t < 40; t++) {
      const b = pool[Math.floor(Math.random() * pool.length)];
      if (b === a || used.has(b)) continue;
      const d = Math.hypot(a.x - b.x, b.y - a.y);
      if (d < maxD && d < bestD && d > 15) { best = b; bestD = d; }
    }
    if (best) { pairs.push({ a, b: best }); used.add(best); }
  }
  return pairs;
}

function clearStars() {
  for (let l = 1; l <= 8; l++) starsByLayer[l].length = 0;
}

function initStars(cw, ch) {
  clearStars();
  const lc = layerCounts(cw, ch);
  for (let l = 8; l >= 1; l--) {
    for (let i = 0; i < lc[l]; i++) {
      starsByLayer[l].push(createStar(l, cw, ch));
    }
  }
  initClusters(cw, ch);
  constellations = makeConstellations();
}

// ── Perf caches ────────────────────────────────────
let _cachedAccent = '';
let _accentFrameTTL = 0;

function getCachedAccent() {
  if (frameCount - _accentFrameTTL > 60) {
    _cachedAccent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d4943a';
    _accentFrameTTL = frameCount;
  }
  return _cachedAccent;
}

// Invalidate accent cache on theme change
document.addEventListener('theme-changed', () => { _accentFrameTTL = 0; });

// Glow gradient cache — keyed by (radius, color)
const glowCache = new Map();
function getGlowGradient(ctx, radius, colorHex) {
  const key = `${radius.toFixed(1)}_${colorHex}`;
  let g = glowCache.get(key);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    g.addColorStop(0, colorHex + '44');
    g.addColorStop(0.2, colorHex + '18');
    g.addColorStop(0.6, colorHex + '04');
    g.addColorStop(1, 'transparent');
    glowCache.set(key, g);
  }
  return g;
}

function drawGlowCached(ctx, x, y, radius, colorHex, intensity) {
  const R = radius * intensity;
  const g = getGlowGradient(ctx, R, colorHex);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Main ──
export function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  initStars(w, h);
  initNebulae(w, h);
  initAurora(w, h);
  initMoon(w, h);

  setInterval(() => { constellations = makeConstellations(); }, 22000);

  function drawNebula(n) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(n.rx, n.ry));
    const pulse = 0.85 + 0.15 * Math.sin(frameCount * 0.0004 + n.phase);
    const a = n.alpha * pulse;
    g.addColorStop(0, `hsla(${n.hue},60%,60%,${a})`);
    g.addColorStop(0.3, `hsla(${n.hue},50%,50%,${a*0.5})`);
    g.addColorStop(0.7, `hsla(${n.hue},40%,40%,${a*0.12})`);
    g.addColorStop(1, 'transparent');
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.scale(1, n.ry / Math.max(1, n.rx));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, n.rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawShooter(s) {
    const tailX = s.x - s.vx * s.len;
    const tailY = s.y - s.vy * s.len;
    const g = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    g.addColorStop(0, `rgba(255,255,255,${0.95*s.life})`);
    g.addColorStop(0.2, `rgba(255,255,240,${0.6*s.life})`);
    g.addColorStop(0.5, `rgba(200,220,255,${0.25*s.life})`);
    g.addColorStop(1, 'transparent');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    drawGlowCached(ctx, s.x, s.y, 2, '#ffffff', 4 * s.life);
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    frameCount++;

    const px = Math.sin(frameCount * 0.00025) * 0.12;
    const py = Math.cos(frameCount * 0.0002) * 0.08;
    const acc = getCachedAccent();

    drawAurora(ctx, w, h, frameCount);
    drawMoon(ctx, frameCount);

    // Nebulae
    for (const n of nebulae) drawNebula(n);

    // Constellation lines
    ctx.strokeStyle = acc + '09';
    ctx.lineWidth = 0.35;
    for (const { a, b } of constellations) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Star clusters
    for (const cl of clusters) {
      for (const m of cl.members) {
        const n = Math.sin(frameCount * 0.0008 + m.twPhase);
        const alpha = m.opacity * (0.85 + 0.15 * n);
        ctx.beginPath();
        ctx.arc(m.x, m.y, Math.max(0.15, m.size), 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.globalAlpha = Math.max(0.02, alpha);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Stars — bucketed by layer, deep to near (8→1), NO sort needed
    // Deep layers 7-8 render every 2nd frame; layer 6 every 2nd frame
    for (let layer = 8; layer >= 1; layer--) {
      // Frame-skip: deep layers update less often
      if (layer >= 7 && frameCount % 2 !== 0) continue;
      if (layer === 6 && frameCount % 2 !== 0) continue;

      const bucket = starsByLayer[layer];
      for (const s of bucket) {
        const n = Math.sin(frameCount * s.twFreq + s.twPhase);
        let twinkle = s.baseOpacity * (1 - s.twAmp + s.twAmp * (0.5 + 0.5 * n));

        if (s.isVariable) {
          const varMod = Math.sin(frameCount * (Math.PI * 2 / s.varPeriod) + s.varPhase);
          twinkle *= (1 + s.varAmp * varMod);
        }

        s.opacity = twinkle;

        const ds = (9 - s.layer) * 0.012;
        s.x += s.vx + px * ds;
        s.y += s.vy + py * ds;
        if (s.x < -8) s.x = w + 8;
        if (s.x > w + 8) s.x = -8;
        if (s.y < -8) s.y = h + 8;
        if (s.y > h + 8) s.y = -8;

        // More aggressive culling of dim stars
        if (s.opacity < 0.04 && Math.random() < 0.6) continue;
        if (s.opacity < 0.02) continue;

        if (s.glow && s.opacity > 0.25) {
          drawGlowCached(ctx, s.x, s.y, s.size, s.color, s.glowR);
        }

        const size = s.size * (layer <= 2 && s.opacity > 0.45 ? 1.35 : 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.2, size), 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.02, s.opacity);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Shooting stars
    if (Math.random() < 0.025 && shooters.length < 5) {
      shooters.push(spawnShooter(w, h));
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.vx; s.y += s.vy;
      s.life -= s.decay;
      if (s.life <= 0) shooters.splice(i, 1);
      else drawShooter(s);
    }

    running = true;
    requestAnimationFrame(animate);
  }

  animate();
}

window.addEventListener('resize', () => {
  if (!running) return;
  const cw = window.innerWidth, ch = window.innerHeight;
  glowCache.clear();
  initStars(cw, ch);
  initNebulae(cw, ch);
  initAurora(cw, ch);
  initMoon(cw, ch);
});
