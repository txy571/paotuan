// ==================== UTILS ====================
export const $ = id => document.getElementById(id);

export function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function showToast(msg) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.remove(); if (!container.children.length) container.remove(); }, 3000);
}

export function modPct(val) {
  const m = Math.floor((val - 50) / 5);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function modPctNum(val) {
  return Math.floor((val - 50) / 5);
}
