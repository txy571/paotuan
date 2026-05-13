// ==================== GAME SAVE SYSTEM ====================
import { state, cocState, kpState, setScenarioDbContent, scenarioDbContent, saveThemeChatHistory, saveThemeApiHistory } from './state.js';
import { showToast } from './utils.js';
import { getCharData, loadCharData, renderAllCharacter } from './character.js';
import { selectRPG } from './theme.js';
import { renderKP, addKPSystemMsg, renderUniversalStatus } from './kp.js';
import { renderCocStatus, renderCocChronicle } from './coc-status.js';
import { THEME_NAMES } from './state.js';

export function getGameSaveData() {
  return {
    version: 2,
    theme: state.theme,
    timestamp: new Date().toISOString(),
    character: getCharData(),
    cocState: { ...cocState, chronicle: [...cocState.chronicle], skillChecks: [...cocState.skillChecks] },
    chatHistory: kpState.chatHistory.slice(-200),
    apiHistory: kpState.apiHistory.slice(-80),
  };
}

export function loadGameSaveData(data) {
  if (!data || data.version < 1) return false;
  if (data.theme && THEME_NAMES[data.theme]) selectRPG(data.theme);
  if (data.character) loadCharData(data.character);
  if (data.cocState) {
    cocState.luck = data.cocState.luck ?? 50;
    cocState.mp = data.cocState.mp ?? 10;
    cocState.maxMp = data.cocState.maxMp ?? 10;
    cocState.cthulhuMythos = data.cocState.cthulhuMythos ?? 0;
    cocState.chronicle = data.cocState.chronicle || [];
    cocState.skillChecks = data.cocState.skillChecks || [];
  }
  if (data.chatHistory) kpState.chatHistory = data.chatHistory;
  if (data.apiHistory) kpState.apiHistory = data.apiHistory;
  // Persist loaded data to theme-scoped storage
  if (kpState.chatHistory.length) {
    saveThemeChatHistory(state.theme, kpState.chatHistory);
    saveThemeApiHistory(state.theme, kpState.apiHistory);
  }
  renderAllCharacter();
  renderKP();
  renderCocStatus();
  renderUniversalStatus();
  renderCocChronicle();
  if (kpState.active) {
    const hero = document.getElementById('kpHero');
    const panel = document.getElementById('kpChatWrapper');
    if (hero) hero.style.display = 'none';
    if (panel) panel.style.display = '';
  }
  return true;
}

export function saveGame(slotName) {
  const data = getGameSaveData();
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  saves[slotName] = data;
  localStorage.setItem('ttrpg-game-saves', JSON.stringify(saves));
  localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
  showToast(`游戏存档 "${slotName}" 已保存! (含角色数据+完整上下文)`);
}

export function loadGame(slotName) {
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  const data = saves[slotName];
  if (!data) { showToast('存档不存在'); return false; }
  if (loadGameSaveData(data)) {
    showToast(`游戏存档 "${slotName}" 已加载!`);
    return true;
  }
  showToast('存档格式错误');
  return false;
}

export function deleteGame(slotName) {
  if (!confirm(`确定要删除存档 "${slotName}" 吗？此操作不可撤销。`)) return;
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  delete saves[slotName];
  localStorage.setItem('ttrpg-game-saves', JSON.stringify(saves));
  renderGameSaves();
  showToast(`存档 "${slotName}" 已删除`);
}

export function loadAutosave() {
  const data = JSON.parse(localStorage.getItem('ttrpg-game-autosave') || 'null');
  if (data && loadGameSaveData(data)) {
    showToast('自动存档已加载!');
    return true;
  }
  showToast('没有可用的自动存档');
  return false;
}

export function renderGameSaves() {
  const container = document.getElementById('gameSavesList');
  if (!container) return;
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  // Filter by current theme
  const currentTheme = state.theme;
  const entries = Object.entries(saves)
    .filter(([, data]) => data.theme === currentTheme)
    .sort(([,a],[,b]) => (b.timestamp||'').localeCompare(a.timestamp||''));
  if (!entries.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:.75rem;padding:8px;text-align:center;">暂无存档 — 点击"存档"保存当前游戏进度</div>';
    return;
  }
  container.innerHTML = entries.map(([name, data]) => {
    const charName = data.character?.name || '未知角色';
    const date = data.timestamp ? new Date(data.timestamp).toLocaleString('zh-CN') : '未知时间';
    const msgCount = data.chatHistory?.filter(m => m.role === 'gm' && !m.content.startsWith('[')).length || 0;
    const hp = data.character?.hp ?? data.character?.attributes?.stats?.hp ?? '?';
    const san = data.character?.san ?? '?';
    const escName = name.replace(/'/g, "\\'");
    return `<div class="game-save-item" data-action="saves:load" data-name="${escName}">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
        </div>
        <div style="font-size:.7rem;color:var(--text-dim);margin-top:2px;">
          ${charName} · ${msgCount}轮 · HP:${hp} SAN:${san} · ${date}
        </div>
      </div>
      <button class="equip-del-btn" data-action="saves:delete" data-name="${escName}" title="删除">🗑️</button>
    </div>`;
  }).join('');
}
