// ==================== MULTIPLAYER: UI RENDERING ====================
import { state, THEME_NAMES, cocState } from '../state.js';
import { esc, showToast } from '../utils.js';
import { M, collectMyCharData } from './connection.js';
import { KP_QUICK_ACTIONS } from '../state.js';
import { sendToPlayer, broadcastToAll } from './host.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';
import { renderTraits, renderEquipment, renderAttributes, renderSkills } from '../character.js';

// ── View Toggle ────────────────────────────────────
export function showLobbyView() {
  const lobby = document.getElementById('mpLobby');
  const room = document.getElementById('mpRoom');
  if (lobby) lobby.style.display = '';
  if (room) room.style.display = 'none';
  document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mp-tab-panel').forEach(p => p.classList.remove('active'));
  const t = document.querySelector('.mp-tab[data-mp-tab="create"]');
  const p = document.getElementById('mpTabCreate');
  if (t) t.classList.add('active');
  if (p) p.classList.add('active');
  const saved = localStorage.getItem('ttrpg-mp-nickname');
  if (saved) {
    const ci = document.getElementById('mpCreateName');
    const ji = document.getElementById('mpJoinName');
    if (ci && !ci.value) ci.value = saved;
    if (ji && !ji.value) ji.value = saved;
  }
}

export function showRoomView() {
  const lobby = document.getElementById('mpLobby');
  const room = document.getElementById('mpRoom');
  if (lobby) lobby.style.display = 'none';
  if (room) room.style.display = '';
  const label = document.getElementById('mpRoomLabelDisplay');
  if (label) label.textContent = '联机房';
  const idDisp = document.getElementById('mpRoomIdDisplay');
  if (idDisp) idDisp.textContent = M.isHost ? '房间号: ' + M.roomId : '已加入: ' + M.roomId;
  const phaseBadge = document.getElementById('mpPhaseBadge');
  if (phaseBadge) {
    phaseBadge.textContent = M.gamePhase === 'lobby' ? '准备阶段' : '游戏中';
    phaseBadge.style.background = M.gamePhase === 'lobby' ? 'rgba(74,138,48,.15)' : 'var(--accent-dim)';
  }
  document.dispatchEvent(new CustomEvent('mp-conn-dot', { detail: 'connected' }));
  renderAllRoom();
}

// ── Render All ─────────────────────────────────────
export function renderAllRoom() {
  renderPlayerList();
  renderMultiplayerChat();
  renderTurnBanner();
  renderLobbyControls();
  scrollChatBottom();
}

// ── Chat ───────────────────────────────────────────
export function addChatMessage(type, sender, content) {
  M.chatLog.push({ type, sender, content, time: new Date().toLocaleTimeString(), id: Date.now() + '-' + Math.random().toString(36).substr(2, 5) });
  if (M.chatLog.length > 400) M.chatLog = M.chatLog.slice(-400);
  renderMultiplayerChat();
}

export function renderMultiplayerChat() {
  const c = document.getElementById('mpKPMessages');
  if (!c) return;
  if (!M.chatLog.length) {
    c.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;font-size:.88rem;">输入行动指令开始冒险... 所有玩家可见</div>';
    return;
  }
  c.innerHTML = M.chatLog.map(m => {
    let cls, content;
    switch (m.type) {
      case 'kp': cls = 'gm'; content = '<div class="msg-sender" style="color:var(--text-gold);">[KP] ' + esc(m.sender) + '</div>' + esc(m.content); break;
      case 'kp-error': cls = 'gm'; content = '<div class="msg-sender" style="color:var(--accent2);">[ERR] ' + esc(m.sender) + '</div>' + esc(m.content); break;
      case 'action': cls = 'action'; content = '<div class="msg-sender" style="color:var(--accent);">[ACT] ' + esc(m.sender) + '</div>' + esc(m.content); break;
      case 'chat': cls = 'chat'; content = '<div class="msg-sender" style="color:var(--text-dim);">[MSG] ' + esc(m.sender) + '</div>' + esc(m.content); break;
      case 'secret': cls = 'secret'; content = '<div class="msg-sender" style="color:var(--accent2);">[SEC] ' + esc(m.sender) + ' (秘密)</div>' + esc(m.content) + '<div class="msg-secret-tag">仅KP可见</div>'; break;
      case 'secret-kp': cls = 'secret'; content = '<div class="msg-sender" style="color:var(--accent2);">[SEC] ' + esc(m.sender) + '</div>' + esc(m.content) + '<div class="msg-secret-tag">仅你可见</div>'; break;
      case 'dice': cls = 'action'; content = '<div class="msg-sender" style="color:var(--accent);">[DICE] ' + esc(m.sender) + ' 掷骰</div>' + esc(m.content); break;
      default: cls = 'system'; content = esc(m.content);
    }
    return '<div class="mp-msg ' + cls + '">' + content + '</div>';
  }).join('');
}

export function scrollChatBottom() {
  const c = document.getElementById('mpKPMessages');
  if (c) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 60);
}

// ── Player List ────────────────────────────────────
export function renderPlayerList() {
  const c = document.getElementById('mpPlayerList');
  if (!c) return;
  const entries = Object.values(M.players).sort((a, b) => {
    if (a.isHost) return -1; if (b.isHost) return 1;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
  if (!entries.length) {
    c.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;text-align:center;padding:16px;">暂无玩家</div>';
  } else {
    c.innerHTML = entries.map(p => {
      const isMe = p.id === M.playerId;
      const isHost = p.isHost;
      const cls = (isHost ? ' host' : '') + (isMe ? ' you' : '');
      const av = (p.name || '?')[0].toUpperCase();
      const badge = isHost ? '<span class="mp-player-badge host-badge">房主</span>' : (isMe ? '<span class="mp-player-badge you-badge">你</span>' : '');
      const stats = [];
      if (p.charName) stats.push(p.charName);
      if (p.hp !== undefined && p.hp !== '?') stats.push('HP:' + p.hp);
      if (p.san !== undefined && p.san !== '?') stats.push('SAN:' + p.san);
      const readyMark = p.ready ? ' [已准备]' : (M.gamePhase === 'lobby' ? ' [等待中]' : '');
      const statsText = (stats.join(' | ') || '状态未知') + readyMark;
      return '<div class="mp-player-item' + cls + '"><div class="mp-player-avatar">' + av + '</div><div class="mp-player-info"><div class="mp-player-name">' + esc(p.name) + '</div><div class="mp-player-stats">' + esc(statsText) + '</div></div>' + badge + '</div>';
    }).join('');
  }
  const cnt = document.getElementById('mpPeerCount');
  if (cnt) cnt.textContent = entries.length + ' 人在线';
  const mi = document.getElementById('mpMyInfo');
  if (mi) mi.innerHTML = esc(M.playerName) + (M.isHost ? ' (房主)' : '') + ' | ' + (M.gamePhase === 'lobby' ? '准备阶段' : '游戏中');
}

// ── Turn Banner ────────────────────────────────────
export function renderTurnBanner() {
  const c = document.getElementById('mpTurnBanner');
  if (!c) return;
  if (M.gamePhase !== 'playing') { c.style.display = 'none'; return; }
  c.style.display = '';
  const cp = M.turnOrder[M.currentTurnIndex];
  const cpName = M.players[cp]?.name || '?';
  const isMe = cp === M.playerId;
  let html = '当前行动: <strong>' + esc(cpName) + '</strong>';
  if (isMe) html += ' <span style="color:var(--text-gold);font-weight:700;">[你的回合]</span>';
  html += ' &nbsp;|&nbsp; 顺序: ' + M.turnOrder.map((id, i) => {
    const nm = M.players[id]?.name || '?';
    return i === M.currentTurnIndex ? '<strong style="color:var(--text-gold);">' + esc(nm) + '</strong>' : esc(nm);
  }).join(' → ');
  c.innerHTML = html;
  const btn = document.getElementById('mpEndTurnBtn');
  if (btn) btn.style.display = (isMe || M.isHost) ? '' : 'none';
}

// ── Lobby Controls ─────────────────────────────────
export function renderLobbyControls() {
  const c = document.getElementById('mpLobbyControls');
  if (!c) return;
  if (M.gamePhase !== 'lobby') { c.style.display = 'none'; return; }
  c.style.display = '';
  populateRoomCharSelect();
  renderSlotsGrid();

  const myData = M.players[M.playerId]?.charData || collectMyCharData();
  const hasChar = myData && myData.name;

  const readyBtn = document.getElementById('mpReadyBtn');
  const charWarn = document.getElementById('mpRoomCharWarn');
  if (readyBtn) {
    const isReady = M.readyPlayers.has(M.playerId);
    readyBtn.textContent = isReady ? '取消准备' : '准备就绪';
    readyBtn.className = 'btn ' + (isReady ? 'btn-ghost' : 'btn-save') + ' btn-sm';
    if (!isReady) {
      readyBtn.disabled = !hasChar;
      if (charWarn) charWarn.style.display = hasChar ? 'none' : '';
    } else {
      readyBtn.disabled = false;
      if (charWarn) charWarn.style.display = 'none';
    }
  }

  const charInfo = document.getElementById('mpRoomCharInfo');
  if (charInfo && hasChar) {
    charInfo.style.display = '';
    const parts = [];
    if (myData.race) parts.push(myData.race);
    if (myData.cls) parts.push(myData.cls);
    if (myData.level) parts.push('Lv.' + myData.level);
    if (myData.hp) parts.push('HP:' + myData.hp);
    charInfo.textContent = myData.name + (parts.length ? ' | ' + parts.join(' | ') : '');
  }

  const startBtn = document.getElementById('mpStartGameBtn');
  if (startBtn) {
    startBtn.style.display = M.isHost ? '' : 'none';
    const allPlayers = Object.values(M.players);
    const total = allPlayers.length;
    const ready = allPlayers.filter(p => p.ready).length;
    const allHaveChars = allPlayers.every(p => p.charData && p.charData.name);
    startBtn.textContent = '开始游戏 (' + ready + '/' + total + ' 已准备)';
    startBtn.disabled = ready < total || total < 1 || !allHaveChars;
    if (!allHaveChars && total > 0) startBtn.title = '所有玩家必须选择角色卡后才能开始游戏';
    else startBtn.title = '';
  }
}

// ── Room Char Select ───────────────────────────────
function populateRoomCharSelect() {
  const sel = document.getElementById('mpRoomCharSelect');
  if (!sel) return;
  const currentVal = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  const saved = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const entries = Object.values(saved);
  entries.forEach((ch, i) => {
    if (ch.name) {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name + (ch.race ? ' (' + ch.race + ')' : '') + (ch.cls ? ' - ' + ch.cls : '');
      sel.appendChild(opt);
    }
  });
  if (currentVal) sel.value = currentVal;
}

// ── Slots Grid ─────────────────────────────────────
function renderSlotsGrid() {
  const grid = document.getElementById('mpSlotsGrid');
  if (!grid) return;
  const allPlayers = Object.values(M.players);
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const p = allPlayers[i];
    if (p) {
      const cd = p.charData || {};
      const isReady = p.ready;
      const cls = 'mp-slot filled' + (isReady ? ' ready' : '');
      const name = esc(p.name || '玩家');
      const charName = cd.name || '未选角色';
      const stats = [];
      if (cd.race) stats.push(cd.race);
      if (cd.cls) stats.push(cd.cls);
      if (cd.hp) stats.push('HP:' + cd.hp);
      const statsText = stats.length ? stats.join(' | ') : '';
      const statusCls = isReady ? 'slot-badge ready-badge' : 'slot-badge wait-badge';
      const statusText = isReady ? '已准备' : '等待中';
      slots.push('<div class="' + cls + '"><div class="slot-num">' + (i+1) + '</div><div class="slot-name">' + name + '</div><div class="slot-char">' + esc(charName) + '</div>' + (statsText ? '<div class="slot-stats">' + esc(statsText) + '</div>' : '') + '<div class="' + statusCls + '">' + statusText + '</div></div>');
    } else {
      slots.push('<div class="mp-slot empty"><div class="slot-num">' + (i+1) + '</div><div class="slot-name">空位</div><div class="slot-char">等待玩家加入</div></div>');
    }
  }
  grid.innerHTML = slots.join('');
}

// ── Quick Actions ──────────────────────────────────
export function renderQuickActions() {
  const c = document.getElementById('mpKPQuickActions');
  if (!c) return;
  const actions = KP_QUICK_ACTIONS[state.theme] || KP_QUICK_ACTIONS.dnd;
  c.innerHTML = actions.map(a => '<button class="mp-quick-btn" data-action="mp:quick" data-action-name="' + a + '">' + a + '</button>').join('');
}

// ── Refresh UI ─────────────────────────────────────
export function refreshUI() {
  const theme = THEME_NAMES[state.theme];
  const el = document.getElementById('mpKPTheme');
  if (el) el.textContent = '(' + theme + ')';
  renderQuickActions();
  renderTurnBanner();
}

// ── On Page Open ───────────────────────────────────
export function onPageOpen() {
  refreshUI();
  populateLobbyCharSelects();
  if (M.connected) {
    showRoomView();
    renderAllRoom();
  } else {
    showLobbyView();
  }
}

function populateLobbyCharSelects() {
  const saved = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const chars = Object.values(saved);
  ['mpCreateChar', 'mpJoinChar'].forEach(sid => {
    const sel = document.getElementById(sid);
    if (!sel) return;
    const prevVal = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    chars.forEach(ch => {
      if (ch.name) {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.name + (ch.race ? ' (' + ch.race + ')' : '') + (ch.cls ? ' - ' + ch.cls : '');
        sel.appendChild(opt);
      }
    });
    if (prevVal && [...sel.options].some(o => o.value === prevVal)) sel.value = prevVal;
  });

  const hasSheetChar = () => {
    const cd = collectMyCharData();
    return !!(cd && cd.name);
  };

  const updateBtnState = (btn, sel, btnLabel) => {
    if (!btn) return;
    if (sel.value || hasSheetChar()) {
      btn.disabled = false;
      btn.textContent = btnLabel;
    } else {
      btn.disabled = true;
      btn.textContent = '请先选择角色卡';
    }
  };

  const applyLobbyChar = (selId, infoId, btnId, btnLabel) => {
    const sel = document.getElementById(selId);
    const btn = document.getElementById(btnId);
    if (!sel || sel._bound) return;
    sel._bound = true;
    sel.addEventListener('change', () => {
      const id = sel.value;
      const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
      const ch = chars[id];
      const info = document.getElementById(infoId);
      if (ch) {
        document.dispatchEvent(new CustomEvent('mp-apply-char', { detail: ch }));
        if (info) {
          info.style.display = '';
          info.textContent = [ch.race, ch.cls, ch.level ? 'Lv.'+ch.level : ''].filter(Boolean).join(' | ') || ch.name;
        }
      } else {
        if (info) info.style.display = 'none';
      }
      updateBtnState(btn, sel, btnLabel);
    });
    updateBtnState(btn, sel, btnLabel);
  };
  applyLobbyChar('mpCreateChar', 'mpCreateCharInfo', 'mpCreateBtn', '创建房间');
  applyLobbyChar('mpJoinChar', 'mpJoinCharInfo', 'mpJoinBtn', '加入房间');
}

// ── Room Char Changed ──────────────────────────────
export function mpRoomCharChanged() {
  const sel = document.getElementById('mpRoomCharSelect');
  if (!sel) return;
  const id = sel.value;
  const saved = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const ch = saved[id];
  if (!ch) {
    if (M.players[M.playerId]) {
      M.players[M.playerId].charData = null;
      M.players[M.playerId].charName = '';
    }
    renderLobbyControls();
    return;
  }
  document.dispatchEvent(new CustomEvent('mp-apply-char', { detail: ch }));
  const cd = collectMyCharData();
  if (M.players[M.playerId]) {
    M.players[M.playerId].charData = cd;
    M.players[M.playerId].charName = cd.name || '';
    M.players[M.playerId].hp = cd.hp || cd.cocHp || '?';
    M.players[M.playerId].san = cd.cocSan || cd.san || '?';
  }
  if (M.isHost) {
    broadcastToAll({ type: 'player-list', players: M.players });
    broadcastToAll({ type: 'game-state', gameState: getGameStateSnapshot(), players: M.players, theme: state.theme });
  } else if (M.hostConn && M.hostConn.open) {
    M.hostConn.send({ type: 'char-update', playerId: M.playerId, charData: cd });
  }
  showToast('已选择角色: ' + (cd.name || '无'));
  renderLobbyControls();
}

// Re-export from host.js so index.js doesn't need circular imports
import { getGameStateSnapshot } from './connection.js';
