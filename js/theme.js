import { state, THEME_NAMES, initCocState, cocState } from './state.js';
import { showToast } from './utils.js';

export function selectRPG(theme) {
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
  // trigger quick-actions re-render
  document.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
  if (theme === 'coc' && cocState.chronicle.length === 0) { initCocState(); }
  // render coc status via event
  document.dispatchEvent(new CustomEvent('coc-render'));
  showToast(`已切换到 ${THEME_NAMES[theme]} 主题`);
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
