// ==================== COC STATUS RENDERING ====================
import { cocState } from './state.js';
import { esc } from './utils.js';

export function renderCocStatus() {
  const container = document.getElementById('cocStatusBar');
  if (!container) return;
  const sanPct = Math.round((cocState.san / Math.max(cocState.maxSan || 99, 1)) * 100);
  const hpPct  = Math.round((Math.max(0, cocState.currentHp) / Math.max(cocState.maxHp || 1, 1)) * 100);
  const luckPct = Math.round((cocState.luck / 99) * 100);
  container.innerHTML = `
    <div class="coc-stat">
      <span class="coc-stat-label">❤️ HP</span>
      <span class="coc-stat-val">${cocState.currentHp}/${cocState.maxHp}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill hp" style="width:${hpPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">🧠 SAN</span>
      <span class="coc-stat-val" style="color:${cocState.san < 20 ? 'var(--accent2)' : 'var(--text)'}">${cocState.san}/${cocState.maxSan}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill san" style="width:${sanPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">🍀 LUCK</span>
      <span class="coc-stat-val">${cocState.luck}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill luck" style="width:${luckPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">✨ MP</span>
      <span class="coc-stat-val">${cocState.mp}/${cocState.maxMp}</span>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">📖 CMI</span>
      <span class="coc-stat-val" style="color:${cocState.cthulhuMythos > 10 ? 'var(--accent2)' : 'var(--text)'}">${cocState.cthulhuMythos}%</span>
    </div>
  `;
}

export function renderCocChronicle() {
  const container = document.getElementById('cocChronicle');
  if (!container) return;
  if (!cocState.chronicle.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;padding:12px;text-align:center;">冒险尚未开始。AI主持人将在剧情发展中自动记录重要事件。</div>';
    return;
  }
  container.innerHTML = cocState.chronicle.slice().reverse().map(c => `
    <div class="chronicle-entry">
      <div class="chronicle-time">${c.time}</div>
      <div class="chronicle-text">${esc(c.text)}</div>
    </div>
  `).join('');

  const scContainer = document.getElementById('cocSkillChecks');
  if (scContainer) {
    if (!cocState.skillChecks.length) {
      scContainer.innerHTML = '<div style="color:var(--text-dim);font-size:.72rem;">暂无</div>';
    } else {
      scContainer.innerHTML = cocState.skillChecks.map(s =>
        `<span class="kp-quick-btn" style="font-size:.7rem;cursor:default;">📝 ${esc(s)}</span>`
      ).join('');
    }
  }
}
