// ==================== THEME SWITCHER & PAGE NAVIGATION ====================
// Switches between the four RPG rule systems (D&D 5e / CoC 7e / Cyberpunk RED /
// Pathfinder 2e) by updating the body[data-theme] attribute, which triggers
// CSS custom property cascading. Also handles SPA page navigation via nav tabs
// and light/dark color scheme toggling.
import { state, kpState, THEME_NAMES, initCocState, cocState } from './state.js';
import { showToast } from './utils.js';

// Import for theme-scoped KP session switching (lazy to avoid circular)
let _switchKPSession = null;
async function ensureKPSessionSwitch() {
  if (!_switchKPSession) {
    const kp = await import('./kp.js');
    _switchKPSession = kp.switchKPSession;
  }
}

export const THEME_ORDER = ['dnd', 'coc', 'cyberpunk', 'pathfinder'];

export function selectRPG(theme) {
  if (!THEME_NAMES[theme]) return;
  if (kpState.active) { showToast('游戏进行中，无法切换规则系统'); return; }
  state.theme = theme;
  document.body.setAttribute('data-theme', theme);
  const themeBadge = document.getElementById('themeBadge');
  if (themeBadge) themeBadge.textContent = THEME_NAMES[theme];
  document.querySelectorAll('.rpg-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.rpg-card[data-theme="${theme}"]`);
  if (card) card.classList.add('selected');
  localStorage.setItem('ttrpg-theme', theme);
  const kpTheme = document.getElementById('kpCurrentTheme');
  if (kpTheme) kpTheme.textContent = THEME_NAMES[theme];
  // sync native select if present
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
  // trigger quick-actions re-render
  document.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
  if (theme === 'coc' && cocState.chronicle.length === 0) { initCocState(); }
  // render coc status via event
  document.dispatchEvent(new CustomEvent('coc-render'));
  // Switch KP session to maintain per-theme game isolation
  ensureKPSessionSwitch().then(() => {
    if (_switchKPSession) _switchKPSession(theme);
  });
  showToast(`已切换到 ${THEME_NAMES[theme]} 主题`);
}

// ── Theme dropdown picker ──────────────────────────
export function toggleThemePicker() {
  if (kpState.active) { showToast('游戏进行中，无法切换规则系统'); return; }
  const dropdown = document.getElementById('themeDropdown');
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// ── Color Scheme (Light / Dark) ───────────────────
export function toggleColorScheme() {
  const current = document.body.getAttribute('data-color-scheme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyColorScheme(next);
}

export function applyColorScheme(scheme) {
  document.body.setAttribute('data-color-scheme', scheme);
  localStorage.setItem('ttrpg-color-scheme', scheme);
  const btn = document.getElementById('colorSchemeToggle');
  if (btn) {
    btn.innerHTML = scheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    btn.title = scheme === 'light' ? '切换到深色模式' : '切换到浅色模式';
  }
}

export function navigateTo(page) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
  if (tab) tab.classList.add('active');
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  document.dispatchEvent(new CustomEvent('page-changed', { detail: page }));
}
