// ==================== INITIALIZATION ====================
import { state, kpState, cocState, ATTR_BASE, ATTR_KEYS, THEME_NAMES } from './state.js';
import { showToast } from './utils.js';
import { dom } from './dom.js';
import { selectRPG, navigateTo, toggleColorScheme, applyColorScheme, toggleThemePicker } from './theme.js';
import * as Character from './character.js';
import * as Notes from './notes.js';
import { fetchAPI, fetchAPIDetail } from './api-browser.js';
import { initParticles } from './particles.js';
import {
  openKPPanel, closeKPPanel, clearKPChat, sendKPMessage, sendQuickAction,
  stopKPStreaming, toggleKPConfig, toggleKPProviderUI, saveKPConfigFromUI,
  loadKPConfig, loadKPChatHistory, renderKP, renderKPQuickActions, checkProxyAvailable,
  testKPConnection, selectHomeChar, renderHomeCharSelect, kpDiceRoll,
} from './kp.js';
import { saveGame, loadGame, deleteGame, loadAutosave, renderGameSaves } from './saves.js';
import * as Scenario from './scenario.js';
import { renderCocStatus, renderCocChronicle } from './coc-status.js';
import { initMemoryBank } from './memory-bank.js';
import { Multiplayer } from './multiplayer/index.js';
import { tts } from './tts.js';

// ── Set up periodic tasks ──────────────────────────
setInterval(() => {
  if (kpState.chatHistory.length) {
    try {
      const toSave = kpState.chatHistory.slice(-200);
      localStorage.setItem('ttrpg-kp-chat', JSON.stringify(toSave));
    } catch(e) {}
  }
  const ta = document.getElementById('scenarioDbContent');
  if (ta && ta.value) {
    try { localStorage.setItem('ttrpg-scenario-db', ta.value); } catch(e) {}
  }
}, 5000);

setInterval(() => {
  if (Multiplayer.connected) Multiplayer.broadcastStatusUpdate();
}, 5000);

// ── DATA-ACTION binding ────────────────────────────
const actionMap = {
  // theme
  'theme:select': (el) => selectRPG(el.dataset.theme || el.value),
  'theme:togglePicker': () => toggleThemePicker(),
  'theme:toggleColorScheme': () => toggleColorScheme(),
  'nav:go': (el) => navigateTo(el.dataset.page),

  // character
  'character:adjustAttr': (el) => Character.adjustAttr(el.dataset.attr, parseInt(el.dataset.delta)),
  'character:toggleSkill': (el) => Character.toggleSkill(el.dataset.skill),
  'character:save': () => Character.saveCharacter(),
  'character:load': (el) => Character.loadCharacter(el.dataset.id),
  'character:delete': (el) => Character.deleteCharacter(el.dataset.id),
  'character:export': () => Character.exportCharacter(),
  'character:import': () => Character.importCharacterPrompt(),
  'character:addTrait': () => Character.addTrait(),
  'character:addFeat': () => Character.addFeat(),
  'character:addEquip': () => Character.addEquipment(),
  'character:addSpell': () => Character.addSpell(),
  'character:editSpell': (el) => Character.editSpell(parseInt(el.dataset.spell)),
  'character:toggleSpellPrepared': (el) => Character.toggleSpellPrepared(parseInt(el.dataset.spell)),
  'character:changeEra': (el) => Character.applyEra(el.value),
  'character:removeInitiative': (el) => Character.removeInitiative(parseInt(el.dataset.id)),
  'character:nextInit': () => Character.nextInitiative(),
  'character:clearInit': () => Character.clearInitiative(),
  'character:addInit': () => Character.addInitiative(),

  // kp / home
  'kp:selectChar': (el) => selectHomeChar(el.dataset.id),

  // notes
  'notes:save': () => Notes.saveSessionNote(),
  'notes:export': () => Notes.exportNotes(false),
  'notes:exportSelected': () => Notes.exportSelected(),
  'notes:exportEncrypted': () => Notes.exportEncrypted(),
  'notes:importPrompt': () => Notes.importNotesPrompt(),
  'notes:selectAll': () => Notes.selectAllNotes(),
  'notes:togglePreview': () => Notes.togglePreview(),
  'notes:toolbar': (el) => Notes.insertMarkdown(el.dataset.md),

  // api
  'api:fetch': (el) => fetchAPI(el.dataset.endpoint),

  // kp
  'kp:open': () => openKPPanel(),
  'kp:close': () => closeKPPanel(),
  'kp:clear': () => clearKPChat(),
  'kp:send': () => sendKPMessage(),
  'kp:stop': () => stopKPStreaming(),
  'kp:config': () => { toggleKPConfig(); loadKPConfig(); },
  'kp:toggleProviderUI': () => toggleKPProviderUI(),
  'kp:saveConfig': () => saveKPConfigFromUI(),
  'kp:testConnection': () => testKPConnection(),
  'kp:quick': (el) => sendQuickAction(el.dataset.actionName),
  'kp:diceRoll': () => kpDiceRoll(),

  // saves
  'saves:save': () => {
    const input = document.getElementById('gameSaveSlot');
    saveGame(input?.value || '冒险存档');
    if (input) input.value = '';
  },
  'saves:load': (el) => loadGame(el.dataset.name),
  'saves:delete': (el) => deleteGame(el.dataset.name),
  'saves:autosave': () => loadAutosave(),

  // tracking panel
  'tracking:toggle': () => {
    import('./tracking-panel.js').then(m => m.toggleTrackingPanel());
  },

  // scenario
  'scenario:toggle': () => Scenario.toggleScenarioDB(),
  'scenario:close': () => Scenario.closeScenarioDB(),
  'scenario:save': () => Scenario.saveScenarioFromForm(),
  'scenario:export': () => Scenario.exportScenarioLibrary(),
  'scenario:import': () => Scenario.importScenarioLibraryPrompt(),
  'scenario:new': () => Scenario.showScenarioForm(),
  'scenario:edit': (el) => Scenario.showScenarioForm(el.dataset.id),
  'scenario:delete': (el) => Scenario.deleteScenario(el.dataset.id),
  'scenario:activate': (el) => Scenario.activateScenario(el.dataset.id),
  'scenario:cancelEdit': () => Scenario.hideScenarioForm(),
  'scenario:addNpc': () => Scenario.addFormArrayField('npc'),
  'scenario:addLocation': () => Scenario.addFormArrayField('loc'),
  'scenario:addClue': () => Scenario.addFormArrayField('clue'),

  // multiplayer
  'mp:create': () => Multiplayer.createRoom(),
  'mp:join': () => Multiplayer.joinRoom(),
  'mp:leave': () => Multiplayer.leaveRoom(),
  'mp:send': () => Multiplayer.sendMessage(),
  'mp:copyId': () => Multiplayer.copyRoomId(),
  'mp:ready': () => Multiplayer.playerReady(),
  'mp:start': () => Multiplayer.startGame(),
  'mp:endTurn': () => Multiplayer.endTurn(),
  'mp:quick': (el) => {
    const input = document.getElementById('mpInput');
    if (input) input.value = el.dataset.actionName;
    Multiplayer.sendMessage();
  },
  'mp:roomCharChanged': () => Multiplayer.mpRoomCharChanged(),

  // tts
  'tts:toggle': () => {
    tts.enabled = !tts.enabled;
    _updateTtsUI();
    tts.saveConfig();
  },
  'tts:saveConfig': () => {
    tts.syncFromUI();
    tts.saveConfig();
    showToast('TTS 配置已保存');
    _updateTtsUI();
  },
  'tts:stop': () => {
    tts.stop();
    _updateTtsUI();
  },
};

// Helper to dispatch an action string
function dispatchAction(action, el) {
  const handler = actionMap[action];
  if (typeof handler === 'function') {
    handler(el);
  } else if (action) {
    const [module, fn] = action.split(':');
    const modMap = { Character, Notes, Multiplayer };
    if (modMap[module] && typeof modMap[module][fn] === 'function') {
      modMap[module][fn](el);
    }
  }
}

// Bind all [data-action] elements on click
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.dataset.actionEvent === 'change') return;
  e.preventDefault();
  dispatchAction(el.dataset.action, el);
});

// Bind [data-action-event="change"] elements
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.dataset.actionEvent !== 'change') return;
  dispatchAction(el.dataset.action, el);
});

// ── Custom event listeners ─────────────────────────
function updateApiSectionTheme() {
  const dndEl = document.getElementById('apiBrowserControls');
  const cocEl = document.getElementById('cocReference');
  const cyberEl = document.getElementById('cyberpunkReference');
  const titleEl = document.getElementById('apiSectionTitle');
  if (dndEl) dndEl.style.display = 'none';
  if (cocEl) cocEl.style.display = 'none';
  if (cyberEl) cyberEl.style.display = 'none';
  switch (state.theme) {
    case 'dnd':
    case 'pathfinder':
      if (dndEl) dndEl.style.display = '';
      if (titleEl) titleEl.textContent = 'D&D 5e 在线资源库';
      break;
    case 'coc':
      if (cocEl) cocEl.style.display = '';
      if (titleEl) titleEl.textContent = 'CoC 7e 规则参考';
      break;
    case 'cyberpunk':
      if (cyberEl) cyberEl.style.display = '';
      if (titleEl) titleEl.textContent = '赛博朋克 RED 规则参考';
      break;
  }
}

document.addEventListener('theme-changed', (e) => {
  renderKPQuickActions();
  renderCocStatus();
  renderCocChronicle();
  updateApiSectionTheme();
  document.dispatchEvent(new CustomEvent('render-game-saves'));
});

document.addEventListener('page-changed', (e) => {
  const page = e.detail;
  if (page === 'character') Character.renderAllCharacter();
  // 'dice' page removed — dice rolling is now embedded in the KP chat
  if (page === 'notes') { Notes.renderSessions(); Notes.renderNotesReference(); }
  if (page === 'home') {
    renderKPQuickActions(); renderKP(); renderCocStatus();
    renderCocChronicle(); renderGameSaves(); renderHomeCharSelect();
  }
  if (page === 'multiplayer') Multiplayer.onPageOpen();
});

document.addEventListener('coc-render', () => {
  renderCocStatus();
  renderCocChronicle();
});

document.addEventListener('character-render', () => {
  Character.renderAttributes();
  Character.renderSkills();
  Character.renderSpells();
});

document.addEventListener('render-game-saves', () => renderGameSaves());

document.addEventListener('load-session', (e) => Notes.loadSession(e.detail));
document.addEventListener('notes-filter', (e) => Notes.filterNotesByTag(e.detail));
document.addEventListener('notes-toggle-select', (e) => Notes.toggleNoteSelect(e.detail));
document.addEventListener('fetch-api', (e) => fetchAPI(e.detail));
document.addEventListener('fetch-detail', (e) => fetchAPIDetail(e.detail.endpoint, e.detail.index));

document.addEventListener('trait-update', (e) => Character.updateTrait(e.detail.i, e.detail.k, e.detail.v));
document.addEventListener('trait-remove', (e) => Character.removeTrait(e.detail));
document.addEventListener('feat-update', (e) => Character.updateFeat(e.detail.i, e.detail.k, e.detail.v));
document.addEventListener('feat-remove', (e) => Character.removeFeat(e.detail));
document.addEventListener('equip-remove', (e) => Character.removeEquip(e.detail));
document.addEventListener('equip-toggle', (e) => Character.toggleEquip(e.detail));
document.addEventListener('spell-remove', (e) => Character.removeSpell(e.detail));
document.addEventListener('preset-trait-add', (e) => Character.addPresetTrait(e.detail.name, e.detail.desc));
document.addEventListener('preset-feat-add', (e) => Character.addPresetFeat(e.detail.name, e.detail.desc));
document.addEventListener('preset-trait-save', (e) => Character.saveTraitPreset(e.detail.i));
document.addEventListener('preset-feat-save', (e) => Character.saveFeatPreset(e.detail.i));
document.addEventListener('skill-update', (e) => { Character.setSkillValue(e.detail.id, e.detail.value); Character.renderSkills(); });
document.addEventListener('dice-rolled', (e) => {
  if (Multiplayer.connected) {
    Multiplayer.rollAndBroadcast(e.detail);
  }
});

// ── Keyboard shortcuts ─────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === '1') navigateTo('home');
  if (e.key === '2') navigateTo('character');
  if (e.key === '3') navigateTo('notes');
  if (e.key === '4') navigateTo('multiplayer');
  if (e.key === '5') navigateTo('about');
});

// ── KP Panel Enter key ─────────────────────────────
const kpInput = document.getElementById('kpInput');
if (kpInput) {
  kpInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendKPMessage();
    }
  });
}

// ── Other Enter key handlers ───────────────────────
if (dom.equipName) dom.equipName.addEventListener('keydown', e => { if (e.key==='Enter') Character.addEquipment(); });
if (dom.initRoll) dom.initRoll.addEventListener('keydown', e => { if (e.key==='Enter') Character.addInitiative(); });

// Notes markdown live preview
const sessionContent = document.getElementById('sessionContent');
if (sessionContent) {
  sessionContent.addEventListener('input', () => {
    Notes.updatePreview();
  });
}

// ── TTS UI update ──────────────────────────────
function _updateTtsUI() {
  const btn = document.getElementById('ttsToggleBtn');
  const ctrl = document.getElementById('kpTtsControls');
  const statusLabel = document.getElementById('ttsStatusLabel');
  const stopBtn = document.getElementById('ttsStopBtn');
  if (btn) {
    btn.textContent = tts.enabled ? '🔊' : '🔇';
    btn.style.opacity = tts.enabled ? '1' : '.5';
    btn.title = tts.enabled ? '关闭语音输出' : '开启语音输出';
  }
  if (ctrl) ctrl.style.display = tts.enabled ? 'flex' : 'none';
  if (statusLabel) {
    statusLabel.textContent = tts.isPlaying ? '正在播放...' : (tts.enabled ? '语音就绪' : '已关闭');
  }
  if (stopBtn) stopBtn.style.display = tts.isPlaying ? '' : 'none';
}

// ── Bootstrap ──────────────────────────────────────
async function init() {
  // Load saved theme
  const savedTheme = localStorage.getItem('ttrpg-theme');
  if (savedTheme && THEME_NAMES[savedTheme]) selectRPG(savedTheme);

  // Load saved color scheme
  const savedScheme = localStorage.getItem('ttrpg-color-scheme') || 'dark';
  applyColorScheme(savedScheme);

  // Theme dropdown outside-click dismiss
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('themeDropdown');
    const picker = document.getElementById('themePicker');
    if (dropdown && picker && dropdown.style.display !== 'none') {
      if (!picker.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    }
  });

  // Set up portrait
  Character.setupPortrait();

  // Load memory bank from localStorage
  initMemoryBank();

  // Initial renders
  Character.renderAllCharacter();
  Character.renderInitiative();
  Notes.renderSessions();
  renderKPQuickActions();
  updateApiSectionTheme();
  loadKPChatHistory();
  loadKPConfig();
  Scenario.loadScenarioDB();
  Scenario.loadScenarioLibrary();
  Scenario.loadActiveScenario();

  // Particle background (starfield)
  initParticles();

  // Check proxy availability (for GitHub Pages + Cloudflare Worker)
  checkProxyAvailable().then(available => {
    if (available) {
      console.log('API proxy detected — AI KP will use proxy');
    } else {
      console.log('No API proxy detected — AI KP will call APIs directly');
    }
  });

  // Cleanup multiplayer on page unload
  window.addEventListener('beforeunload', () => {
    if (Multiplayer.connected) {
      if (Multiplayer.isHost) {
        Multiplayer.broadcastToAll({ type: 'system', content: '🏚️ 房主已离开，房间已关闭' });
      }
      Multiplayer.stopHeartbeat();
    }
  });

  // ── TTS Init ──
  tts.loadConfig();
  tts.syncToUI();
  _updateTtsUI();

  // Auto-stop checkbox live sync
  const autoStopCb = document.getElementById('ttsAutoStop');
  if (autoStopCb) {
    autoStopCb.addEventListener('change', () => {
      tts.syncFromUI();
      tts.saveConfig();
    });
  }

  // Keep TTS UI updated during playback
  setInterval(() => {
    if (tts.enabled) _updateTtsUI();
  }, 500);

  console.log('🎲 TTRPG Companion 已就绪 (含 AI KP + 多人联机)');
  console.log('   %c快捷键: 1首页 2人物卡 3笔记 4联机 5关于','color:var(--text-gold)');
  console.log('   %c🎲 骰子已嵌入AI主持面板，AI请求检定时会自动出现','color:var(--text-dim)');
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
