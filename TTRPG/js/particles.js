// ==================== STARFIELD BACKGROUND ====================
// Multi-layer particle system simulating a realistic night sky:
//   Layer 6 (deepest) — very dim, dense far-field dust
//   Layer 5 — dim stars, slow drift
//   Layer 4 — medium stars, subtle twinkle
//   Layer 3 — brighter mid-field, occasional color tint
//   Layer 2 — bright stars with glow halos
//   Layer 1 (nearest) — very bright, large glow, strong twinkle

let running = false;
let frameCount = 0;

// Stellar color temperatures: O(blue) B(blue-white) A(white) F(yellow-white) G(yellow) K(orange) M(red)
const STELLAR_COLORS = [
  '#9db4ff', // O/B — hot blue (rare, ~1%)
  '#aac3ff', '#b7cdff', '#c4d5ff', // B/A — blue-white (~5%)
  '#cad8ff', '#dae2ff', '#e8ecff', // A — white (~15%)
  '#fff9f0', '#fff5e8', '#fff2e0', // F — yellow-white (~20%)
  '#ffe8c8', '#ffddb0', '#ffd29a', // G — yellow (~20%)
  '#ffc885', '#ffbc72', '#ffb060', // K — orange (~25%)
  '#ff9e4f', '#ff8c3e', '#ff7a30', '#ff6822', // M — red-orange (~14%)
];

function randomStarColor() {
  const r = Math.random();
  if (r < 0.01) return STELLAR_COLORS[0];            // O/B blue
  if (r < 0.06) return STELLAR_COLORS[Math.floor(Math.random() * 3) + 1];   // B/A blue-white
  if (r < 0.21) return STELLAR_COLORS[Math.floor(Math.random() * 3) + 4];   // A white
  if (r < 0.41) return STELLAR_COLORS[Math.floor(Math.random() * 3) + 7];   // F yellow-white
  if (r < 0.61) return STELLAR_COLORS[Math.floor(Math.random() * 3) + 10];  // G yellow
  if (r < 0.86) return STELLAR_COLORS[Math.floor(Math.random() * 3) + 13];  // K orange
  return STELLAR_COLORS[Math.floor(Math.random() * 4) + 16];                  // M red
}

// Per-layer config — tuned for a 1920×1080 viewport (multiplied by area ratio on smaller screens)
function getLayerCounts(cw, ch) {
  const area = cw * ch;
  const base = 1920 * 1080;
  const scale = Math.max(0.4, area / base);
  return {
    6: Math.round(450 * scale),  // deepest — very dim
    5: Math.round(300 * scale),  // dim
    4: Math.round(180 * scale),  // medium
    3: Math.round(90 * scale),   // bright mid
    2: Math.round(40 * scale),   // bright with glow
    1: Math.round(18 * scale),   // nearest — large glow
  };
}

let stars = [];
let constellations = [];

function milkyWayDensity(x, y, w, h) {
  // Diagonal band simulating Milky Way
  const cx = w * 0.35, cy = h * 0.4;
  const angle = 0.55 + 0.3 * Math.cos(x * 0.0004) + 0.2 * Math.sin(y * 0.0005);
  const dx = (x - cx) / w;
  const dy = (y - cy) / h;
  const distFromAxis = Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle)) * 2.5;
  return 0.5 + 0.5 * Math.exp(-distFromAxis * distFromAxis * 3);
}

function createStar(layer, cw, ch) {
  // Non-uniform distribution skewed toward Milky Way band
  let x, y;
  const density = milkyWayDensity(x = Math.random() * cw, y = Math.random() * ch, cw, ch);
  if (Math.random() > density) {
    x = Math.random() * cw;
    y = Math.random() * ch;
  }

  const baseSize = (7 - layer) * 0.45; // layer 6→0.45, layer 1→2.7

  switch (layer) {
    case 6:
      return {
        layer: 6,
        x, y,
        size: Math.random() * 0.6 + 0.2,
        baseOpacity: Math.random() * 0.15 + 0.04,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.015,
        speedY: (Math.random() - 0.5) * 0.015,
        twinkleSpeed: Math.random() * 0.002 + 0.0005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: randomStarColor(),
        glow: false,
      };
    case 5:
      return {
        layer: 5,
        x, y,
        size: Math.random() * 0.7 + 0.4,
        baseOpacity: Math.random() * 0.25 + 0.1,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.03,
        speedY: (Math.random() - 0.5) * 0.03,
        twinkleSpeed: Math.random() * 0.003 + 0.001,
        twinklePhase: Math.random() * Math.PI * 2,
        color: randomStarColor(),
        glow: false,
      };
    case 4:
      return {
        layer: 4,
        x, y,
        size: Math.random() * 0.9 + 0.5,
        baseOpacity: Math.random() * 0.35 + 0.15,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.06,
        speedY: (Math.random() - 0.5) * 0.06,
        twinkleSpeed: Math.random() * 0.005 + 0.002,
        twinklePhase: Math.random() * Math.PI * 2,
        color: randomStarColor(),
        glow: false,
      };
    case 3:
      return {
        layer: 3,
        x, y,
        size: Math.random() * 1.2 + 0.7,
        baseOpacity: Math.random() * 0.35 + 0.35,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.1,
        speedY: (Math.random() - 0.5) * 0.1,
        twinkleSpeed: Math.random() * 0.008 + 0.004,
        twinklePhase: Math.random() * Math.PI * 2,
        color: randomStarColor(),
        glow: true,
      };
    case 2:
      return {
        layer: 2,
        x, y,
        size: Math.random() * 1.8 + 1.0,
        baseOpacity: Math.random() * 0.3 + 0.5,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        twinkleSpeed: Math.random() * 0.015 + 0.006,
        twinklePhase: Math.random() * Math.PI * 2,
        color: randomStarColor(),
        glow: true,
        glowSize: 3,
      };
    case 1:
      return {
        layer: 1,
        x, y,
        size: Math.random() * 2.5 + 1.5,
        baseOpacity: Math.random() * 0.3 + 0.65,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
        twinkleSpeed: Math.random() * 0.025 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.4 ? '#ffffff' : randomStarColor(),
        glow: true,
        glowSize: 6,
      };
    default:
      return null;
  }
}

function generateConstellations() {
  const nearStars = stars.filter(s => s.layer <= 3);
  const pairs = [];
  const maxDist = Math.min(window.innerWidth, window.innerHeight) * 0.25;
  const used = new Set();
  for (let i = 0; i < 6; i++) {
    const a = nearStars[Math.floor(Math.random() * nearStars.length)];
    // Find a nearby star for more natural constellations
    let best = null, bestDist = Infinity;
    for (let tries = 0; tries < 30; tries++) {
      const b = nearStars[Math.floor(Math.random() * nearStars.length)];
      if (b === a || used.has(b)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < maxDist && d < bestDist && d > 20) { best = b; bestDist = d; }
    }
    if (best) {
      pairs.push({ a, b: best });
      used.add(best);
    }
  }
  return pairs;
}

function initStars(cw, ch) {
  stars = [];
  const counts = getLayerCounts(cw, ch);
  for (let layer = 6; layer >= 1; layer--) {
    for (let i = 0; i < counts[layer]; i++) {
      stars.push(createStar(layer, cw, ch));
    }
  }
  constellations = generateConstellations();
}

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

  // Rotate constellation pairs every 25s
  setInterval(() => { constellations = generateConstellations(); }, 25000);

  function getAccent() {
    return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d4943a';
  }

  function drawGlow(x, y, radius, color, intensity) {
    const r = radius * intensity;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const hex = color.length === 7 ? color : '#ffffff';
    gradient.addColorStop(0, hex);
    gradient.addColorStop(0.15, hex + '55');
    gradient.addColorStop(0.5, hex + '11');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const accent = getAccent();
    frameCount++;

    // Subtle parallax — depth layers shift at different rates
    const parallaxX = Math.sin(frameCount * 0.0003) * 0.15;
    const parallaxY = Math.cos(frameCount * 0.00025) * 0.1;

    // Constellation lines (behind stars)
    ctx.strokeStyle = accent + '0A';
    ctx.lineWidth = 0.4;
    for (const { a, b } of constellations) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw stars, deepest layer first
    const sorted = [...stars].sort((a, b) => a.layer - b.layer);
    for (const s of sorted) {
      // Twinkle — deeper layers twinkle less
      const twinkleAmp = (7 - s.layer) * 0.06; // layer 6→0.06, layer 1→0.36
      const noise = Math.sin(frameCount * s.twinkleSpeed + s.twinklePhase);
      s.opacity = s.baseOpacity * (1 - twinkleAmp + twinkleAmp * (0.5 + 0.5 * noise));

      // Slow drift
      const driftScale = (7 - s.layer) * 0.02;
      s.x += s.speedX + parallaxX * driftScale;
      s.y += s.speedY + parallaxY * driftScale;
      if (s.x < -5) s.x = w + 5;
      if (s.x > w + 5) s.x = -5;
      if (s.y < -5) s.y = h + 5;
      if (s.y > h + 5) s.y = -5;

      // Glow behind bright stars
      if (s.glow && s.opacity > 0.25) {
        drawGlow(s.x, s.y, s.size, s.color, s.glowSize || 2.5);
      }

      // Skip faintest stars occasionally for natural feel
      if (s.layer >= 5 && s.opacity < 0.04 && Math.random() < 0.3) continue;

      // Draw star
      ctx.beginPath();
      const drawSize = s.size * (s.layer <= 2 && s.opacity > 0.5 ? 1.3 : 1);
      ctx.arc(s.x, s.y, Math.max(0.3, drawSize), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0.03, s.opacity);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    running = true;
    requestAnimationFrame(animate);
  }

  animate();
}

// Handle resize: regenerate star positions (keep relative positions for stability)
window.addEventListener('resize', () => {
  if (!running) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  initStars(cw, ch);
});
