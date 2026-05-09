// ==================== STARFIELD BACKGROUND ====================
// Three-layer particle system: far field (depth), mid field (twinkle), near field (bright + glow)
let running = false;
let frameCount = 0;

const FAR  = 200;  // count
const MID  = 80;
const NEAR = 15;

let stars = [];       // all stars flattened
let constellations = [];

function createStar(layer) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  switch (layer) {
    case 'far':
      return {
        layer: 'far',
        x: Math.random() * cw, y: Math.random() * ch,
        size: Math.random() * 1.5 + 0.5,
        baseOpacity: Math.random() * 0.3 + 0.1,
        opacity: 0, // computed per frame
        speedX: (Math.random() - 0.5) * 0.04,
        speedY: (Math.random() - 0.5) * 0.04,
        twinkleSpeed: Math.random() * 0.003 + 0.001,
        twinklePhase: Math.random() * Math.PI * 2,
        color: '#ffffff',
      };
    case 'mid':
      return {
        layer: 'mid',
        x: Math.random() * cw, y: Math.random() * ch,
        size: Math.random() * 1.5 + 0.8,
        baseOpacity: Math.random() * 0.4 + 0.3,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        twinkleSpeed: Math.random() * 0.008 + 0.003,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.3
          ? (Math.random() < 0.5 ? '#aaccff' : '#ffddaa')
          : '#ffffff',
      };
    case 'near':
      return {
        layer: 'near',
        x: Math.random() * cw, y: Math.random() * ch,
        size: Math.random() * 2.5 + 1.5,
        baseOpacity: Math.random() * 0.4 + 0.6,
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        isBright: true,
        color: '#ffffff', // accent color applied per-frame
      };
  }
}

function generateConstellations() {
  const nearStars = stars.filter(s => s.layer === 'near');
  const pairs = [];
  for (let i = 0; i < 4; i++) {
    const a = nearStars[Math.floor(Math.random() * nearStars.length)];
    let b = nearStars[Math.floor(Math.random() * nearStars.length)];
    while (b === a) b = nearStars[Math.floor(Math.random() * nearStars.length)];
    pairs.push({ a, b });
  }
  return pairs;
}

function initStars() {
  stars = [];
  for (let i = 0; i < FAR; i++)  stars.push(createStar('far'));
  for (let i = 0; i < MID; i++)  stars.push(createStar('mid'));
  for (let i = 0; i < NEAR; i++) stars.push(createStar('near'));
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

  initStars();

  // Rotate constellation pairs every 30s
  setInterval(() => { constellations = generateConstellations(); }, 30000);

  // Get theme accent color
  function getAccent() {
    return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d4943a';
  }

  function drawGlow(x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, color + '44');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const accent = getAccent();
    frameCount++;

    // Draw constellation lines first (behind stars)
    ctx.strokeStyle = accent + '0C';
    ctx.lineWidth = 0.5;
    for (const { a, b } of constellations) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw stars
    for (const s of stars) {
      // Twinkle
      s.opacity = s.baseOpacity * (0.55 + 0.45 * Math.sin(frameCount * s.twinkleSpeed + s.twinklePhase));

      // Move
      s.x += s.speedX;
      s.y += s.speedY;
      if (s.x < 0) s.x = w;
      if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h;
      if (s.y > h) s.y = 0;

      // Color
      let color = s.color;
      if (s.isBright) {
        color = Math.random() < 0.2 ? accent : '#ffffff';
        // Draw glow behind bright stars
        drawGlow(s.x, s.y, s.size, color);
      }

      // Draw star
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.max(0.05, s.opacity);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    running = true;
    requestAnimationFrame(animate);
  }

  animate();
}

// Handle resize: regenerate star positions
window.addEventListener('resize', () => {
  if (!running) return;
  initStars();
});
