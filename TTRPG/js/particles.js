// ==================== STARFIELD BACKGROUND ====================
// Multi-layer particle system simulating a realistic night sky.
//
// Layers (deepest → nearest):
//   8 — ultra-deep field dust (tiny, dense)
//   7 — very dim distant stars
//   6 — dim field stars
//   5 — medium-faint stars, subtle twinkle
//   4 — medium stars, color tint
//   3 — brighter mid-field, glow halos
//   2 — bright stars, prominent glow
//   1 — very bright, large halo, strong twinkle
//
// Features: Milky Way band, nebula blobs, shooting stars, stellar color spectrum.

let running = false;
let frameCount = 0;

// ── Stellar color temperatures (O B A F G K M) ──
const STELLAR = [
  '#9db4ff', // O/B blue (rare)
  '#a8bfff','#b3c8ff','#bfd0ff','#cad8ff', // B/A blue-white
  '#d4e0ff','#dde6ff','#e6ecff','#eff2ff', // A white
  '#faf8f5','#fff6ed','#fff4e8','#fff0e0', // F yellow-white
  '#ffedd5','#ffe8c8','#ffe3bb','#ffddb0', // G yellow
  '#ffd7a3','#ffd096','#ffc885','#ffc075', // K orange
  '#ffb765','#ffae55','#ffa345','#ff9835','#ff8c25','#ff7a18', // M red-orange
];

function starColor() {
  const r = Math.random();
  if (r < 0.008) return STELLAR[0];                         // O/B
  if (r < 0.05)  return STELLAR[Math.floor(Math.random()*4)+1];   // B/A
  if (r < 0.20)  return STELLAR[Math.floor(Math.random()*4)+5];   // A
  if (r < 0.42)  return STELLAR[Math.floor(Math.random()*4)+9];   // F
  if (r < 0.64)  return STELLAR[Math.floor(Math.random()*4)+13];  // G
  if (r < 0.88)  return STELLAR[Math.floor(Math.random()*4)+17];  // K
  return STELLAR[Math.floor(Math.random()*6)+21];                   // M
}

// ── Layer config (counts for 1920×1080, scaled by viewport area) ──
function layerCounts(cw, ch) {
  const s = Math.max(0.35, (cw * ch) / (1920 * 1080));
  return {
    8: Math.round(600 * s),  // ultra-deep dust
    7: Math.round(450 * s),  // very dim
    6: Math.round(320 * s),  // dim
    5: Math.round(200 * s),  // medium-faint
    4: Math.round(120 * s),  // medium
    3: Math.round(60 * s),   // bright mid
    2: Math.round(28 * s),   // bright
    1: Math.round(14 * s),   // nearest bright
  };
}

// ── Milky Way density — broad diagonal band with wavy edges ──
function milkyWay(x, y, w, h) {
  const cx = w * 0.38, cy = h * 0.45;
  const baseAngle = 0.6;
  const wave = 0.25 * Math.sin(x * 0.0008 + y * 0.0003) + 0.15 * Math.cos(y * 0.0006);
  const angle = baseAngle + wave;
  const dx = (x - cx) / w;
  const dy = (y - cy) / h;
  const dist = Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle));
  // Core + wide halo
  const core = Math.exp(-dist * dist * 12);
  const halo = 0.4 * Math.exp(-dist * dist * 2.5);
  return Math.min(1, 0.45 + 0.55 * (core + halo));
}

// ── Nebula blobs — large, very faint colored patches ──
const nebulae = [];
function initNebulae(w, h) {
  nebulae.length = 0;
  for (let i = 0; i < 5; i++) {
    nebulae.push({
      x: Math.random() * w, y: Math.random() * h,
      rx: 120 + Math.random() * 280,
      ry: 60 + Math.random() * 160,
      alpha: 0.015 + Math.random() * 0.03,
      hue: [210, 280, 340, 30, 180][i], // blue, purple, pink, orange, teal
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// ── Shooting stars ──
let shooters = [];
function spawnShooter(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h * 0.6,
    vx: (Math.random() * 3 + 4) * (Math.random() < 0.5 ? 1 : -1),
    vy: (Math.random() * 1.5 + 1) * (Math.random() < 0.5 ? 1 : -1),
    life: 1,
    decay: 0.008 + Math.random() * 0.02,
    len: 40 + Math.random() * 80,
  };
}

// ── Star creation ──
let stars = [];
let constellations = [];

function createStar(layer, cw, ch) {
  let x = Math.random() * cw, y = Math.random() * ch;
  const mw = milkyWay(x, y, cw, ch);
  if (Math.random() > mw) { x = Math.random() * cw; y = Math.random() * ch; }

  const siz = [0, 2.8, 1.8, 1.3, 0.95, 0.7, 0.5, 0.35, 0.22][layer];
  const sz = siz * (0.5 + Math.random() * 0.5);
  const op = [0, 0.72, 0.55, 0.42, 0.30, 0.20, 0.12, 0.07, 0.04][layer];
  const boost = Math.random() < 0.08 ? 1.4 : 1; // occasional brighter stars
  return {
    layer, x, y,
    size: Math.max(0.18, sz + (Math.random() - 0.5) * sz * 0.5),
    baseOpacity: op * (0.6 + Math.random() * 0.4) * boost,
    opacity: 0,
    vx: (Math.random() - 0.5) * layer * 0.025,
    vy: (Math.random() - 0.5) * layer * 0.025,
    twFreq: (0.0003 + Math.random() * 0.001) * (9 - layer),
    twPhase: Math.random() * Math.PI * 2,
    twAmp: (9 - layer) * (0.04 + Math.random() * 0.04),
    color: starColor(),
    glow: layer <= 3,
    glowR: layer === 1 ? 5.5 : layer === 2 ? 3.5 : 2,
  };
}

function makeConstellations() {
  const pool = stars.filter(s => s.layer <= 4);
  const pairs = [];
  const maxD = Math.min(window.innerWidth, window.innerHeight) * 0.22;
  const used = new Set();
  for (let i = 0; i < 7; i++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    let best = null, bestD = Infinity;
    for (let t = 0; t < 40; t++) {
      const b = pool[Math.floor(Math.random() * pool.length)];
      if (b === a || used.has(b)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < maxD && d < bestD && d > 15) { best = b; bestD = d; }
    }
    if (best) { pairs.push({ a, b: best }); used.add(best); }
  }
  return pairs;
}

function initStars(cw, ch) {
  stars = [];
  const lc = layerCounts(cw, ch);
  for (let l = 8; l >= 1; l--)
    for (let i = 0; i < lc[l]; i++)
      stars.push(createStar(l, cw, ch));
  constellations = makeConstellations();
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

  setInterval(() => { constellations = makeConstellations(); }, 22000);

  function accent() {
    return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d4943a';
  }

  // Glow halo for bright stars
  function drawGlow(x, y, r, color, intensity) {
    const R = r * intensity;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    const hx = color.length === 7 ? color : '#ffffff';
    g.addColorStop(0, hx + '44');
    g.addColorStop(0.2, hx + '18');
    g.addColorStop(0.6, hx + '04');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Nebula blob
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

  // Shooting star
  function drawShooter(s) {
    const tailX = s.x - s.vx * s.len;
    const tailY = s.y - s.vy * s.len;
    const g = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    g.addColorStop(0, `rgba(255,255,255,${0.9*s.life})`);
    g.addColorStop(0.3, `rgba(255,255,240,${0.5*s.life})`);
    g.addColorStop(1, 'transparent');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    // Head glow
    drawGlow(s.x, s.y, 1.5, '#ffffff', 3 * s.life);
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const acc = accent();
    frameCount++;

    const px = Math.sin(frameCount * 0.00025) * 0.12;
    const py = Math.cos(frameCount * 0.0002) * 0.08;

    // Nebulae (deepest background)
    for (const n of nebulae) drawNebula(n);

    // Constellation lines
    ctx.strokeStyle = acc + '09';
    ctx.lineWidth = 0.35;
    for (const { a, b } of constellations) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Stars — sort by layer (deepest first)
    const sorted = [...stars].sort((a, b) => a.layer - b.layer);
    for (const s of sorted) {
      // Twinkle
      const n = Math.sin(frameCount * s.twFreq + s.twPhase);
      s.opacity = s.baseOpacity * (1 - s.twAmp + s.twAmp * (0.5 + 0.5 * n));

      // Drift + parallax
      const ds = (9 - s.layer) * 0.015;
      s.x += s.vx + px * ds;
      s.y += s.vy + py * ds;
      if (s.x < -8) s.x = w + 8;
      if (s.x > w + 8) s.x = -8;
      if (s.y < -8) s.y = h + 8;
      if (s.y > h + 8) s.y = -8;

      // Glow behind bright stars
      if (s.glow && s.opacity > 0.22)
        drawGlow(s.x, s.y, s.size, s.color, s.glowR);

      // Skip ultra-faint stars randomly (simulates atmospheric extinction)
      if (s.layer >= 7 && s.opacity < 0.03 && Math.random() < 0.35) continue;

      // Draw
      ctx.beginPath();
      const ds2 = s.size * (s.layer <= 2 && s.opacity > 0.45 ? 1.35 : 1);
      ctx.arc(s.x, s.y, Math.max(0.2, ds2), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0.025, s.opacity);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Shooting stars
    if (Math.random() < 0.003 && shooters.length < 2) {
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
  initStars(cw, ch);
  initNebulae(cw, ch);
});
