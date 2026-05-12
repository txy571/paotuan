// ==================== SCENARIO TRACKING PANEL ====================
import { scenarioMeta } from './state.js';
import { esc } from './utils.js';

export function renderTrackingPanel() {
  const container = document.getElementById('kpTrackingPanel');
  if (!container) return;

  if (!scenarioMeta.actCount && !scenarioMeta.background) {
    container.innerHTML = `
      <div class="tracking-empty">
        <div class="tracking-empty-icon">📋</div>
        <div>游戏开始后，剧本追踪信息将在此显示</div>
        <div style="font-size:.7rem;color:var(--text-dim);margin-top:4px;">AI主持人将自动管理幕结构、任务和提纲</div>
      </div>`;
    return;
  }

  let metaHTML = '';
  // Synopsis first — the most important overview
  let synopsisHTML = '';
  if (scenarioMeta.synopsis) {
    synopsisHTML = `<div class="tracking-section">
      <div class="tracking-section-title">📜 剧本梗概</div>
      <div class="tracking-synopsis">${esc(scenarioMeta.synopsis)}</div>
    </div>`;
  }

  if (scenarioMeta.background || scenarioMeta.era || scenarioMeta.playerCount || scenarioMeta.actCount) {
    metaHTML = `<div class="tracking-section">
      <div class="tracking-section-title">📖 剧本信息</div>
      ${scenarioMeta.background ? `<div class="tracking-field"><span class="tracking-label">背景</span>${esc(scenarioMeta.background)}</div>` : ''}
      ${scenarioMeta.era ? `<div class="tracking-field"><span class="tracking-label">年代</span>${esc(scenarioMeta.era)}</div>` : ''}
      ${scenarioMeta.playerCount ? `<div class="tracking-field"><span class="tracking-label">人数</span>${esc(scenarioMeta.playerCount)}</div>` : ''}
      ${scenarioMeta.actCount ? `<div class="tracking-field"><span class="tracking-label">幕数</span>${scenarioMeta.actCount}幕 · ${esc(scenarioMeta.estimatedDuration || '?')}</div>` : ''}
    </div>`;
  }

  let actHTML = '';
  if (scenarioMeta.acts.length > 0) {
    actHTML = `<div class="tracking-section">
      <div class="tracking-section-title">🎬 幕进度</div>
      <div class="tracking-act-list">`;
    scenarioMeta.acts.forEach((act) => {
      const icon = act.status === 'completed' ? '✅' : act.status === 'started' ? '▶️' : '⏸️';
      const cls = act.status === 'completed' ? 'act-done' : act.status === 'started' ? 'act-current' : 'act-pending';
      actHTML += `<div class="tracking-act-item ${cls}">
        <span class="act-icon">${icon}</span>
        <span class="act-name">${esc(act.name)}</span>
      </div>`;
    });
    actHTML += `</div></div>`;
  }

  let taskHTML = '';
  const activeTasks = scenarioMeta.tasks.filter(t => t.status === 'active');
  const completedTasks = scenarioMeta.tasks.filter(t => t.status === 'completed');
  if (activeTasks.length || completedTasks.length) {
    taskHTML = `<div class="tracking-section">
      <div class="tracking-section-title">📝 当前任务</div>`;
    activeTasks.forEach(t => {
      taskHTML += `<div class="tracking-task active">🔲 ${esc(t.description)}</div>`;
    });
    if (completedTasks.length) {
      taskHTML += `<div class="tracking-section-title" style="margin-top:8px;font-size:.72rem;">已完成</div>`;
      completedTasks.slice(-5).forEach(t => {
        taskHTML += `<div class="tracking-task completed">✅ ${esc(t.description)}</div>`;
      });
    }
    taskHTML += `</div>`;
  }

  let outlineHTML = '';
  if (scenarioMeta.outline) {
    outlineHTML = `<div class="tracking-section">
      <div class="tracking-section-title">📜 剧本提纲</div>
      <div class="tracking-outline">${esc(scenarioMeta.outline)}</div>
    </div>`;
  }

  container.innerHTML = synopsisHTML + metaHTML + actHTML + taskHTML + outlineHTML;
}

export function toggleTrackingPanel() {
  const panel = document.getElementById('kpRightColumn');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? '' : 'none';
  const btn = document.getElementById('kpTrackingToggle');
  if (btn) btn.textContent = isHidden ? '◀' : '▶';
}
