// ==================== MULTIPLAYER NAMESPACE ====================
import { M, initPeer, startHeartbeat, stopHeartbeat, cleanup as connCleanup,
         updateConnDot, attemptReconnect, collectMyCharData, applyCharDataToSheet,
         getGameStateSnapshot, applyGameState, generateUUID, queueMessage, flushMessageQueue } from './connection.js';
import { setupHostListeners, handleHostMessage, advanceTurn, getCurrentTurnPlayerId, isMyTurn,
         broadcastToAll, sendToPlayer, syncCharToPlayer, processHostAIAction, processHostAISecret } from './host.js';
import { setupClientListeners, connectToHost } from './client.js';
import { showLobbyView, showRoomView, renderAllRoom, addChatMessage, renderMultiplayerChat,
         renderPlayerList, renderTurnBanner, renderLobbyControls, renderQuickActions,
         refreshUI, onPageOpen, mpRoomCharChanged } from './ui.js';
import { generateGameStartScenario } from './game-start.js';
import { state, THEME_NAMES, cocState } from '../state.js';
import { showToast, esc } from '../utils.js';
import { selectRPG } from '../theme.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';
import { renderTraits, renderEquipment, renderAttributes, renderSkills } from '../character.js';
import { renderKPQuickActions } from '../kp.js';
import { getGameSaveData } from '../saves.js';

let _reconnectToastEl = null;

function showReconnectToast(msg, isError) {
  let t = _reconnectToastEl;
  if (!t) { t = document.createElement('div'); t.className = 'mp-reconnect-toast'; document.body.appendChild(t); _reconnectToastEl = t; }
  t.className = 'mp-reconnect-toast' + (isError ? ' error' : '');
  t.textContent = msg; t.style.display = '';
  if (isError) setTimeout(dismissReconnectToast, 8000);
}

function dismissReconnectToast() {
  if (_reconnectToastEl) _reconnectToastEl.style.display = 'none';
}

// ── Public API ─────────────────────────────────────
export const Multiplayer = {
  // State
  get peer() { return M.peer; },
  get isHost() { return M.isHost; },
  get connected() { return M.connected; },
  get roomId() { return M.roomId; },
  get playerId() { return M.playerId; },
  get playerName() { return M.playerName; },
  get players() { return M.players; },
  get gamePhase() { return M.gamePhase; },
  get turnOrder() { return M.turnOrder; },
  get currentTurnIndex() { return M.currentTurnIndex; },
  get chatLog() { return M.chatLog; },
  get inputMode() { return M.inputMode; },

  // Connection
  initPeer,
  startHeartbeat,
  stopHeartbeat,
  cleanup: connCleanup,
  updateConnDot,
  collectMyCharData,
  applyCharDataToSheet,
  getGameStateSnapshot,
  applyGameState,

  // Host
  setupHostListeners,
  handleHostMessage,
  advanceTurn,
  getCurrentTurnPlayerId,
  isMyTurn,
  broadcastToAll,
  sendToPlayer,
  syncCharToPlayer,
  processHostAIAction,
  processHostAISecret,

  // Client
  setupClientListeners,
  connectToHost,

  // UI
  showLobbyView,
  showRoomView,
  renderAllRoom,
  addChatMessage,
  renderMultiplayerChat,
  renderPlayerList,
  renderTurnBanner,
  renderLobbyControls,
  renderQuickActions,
  refreshUI,
  onPageOpen,
  mpRoomCharChanged,

  // Game Start
  generateGameStartScenario,

  // Toast
  showReconnectToast,
  dismissReconnectToast,

  // ── Create Room ──────────────────────────────────
  async createRoom() {
    const nameInput = document.getElementById('mpCreateName');
    const name = (nameInput?.value?.trim()) || ('冒险者' + Math.floor(Math.random() * 9000 + 1000));
    if (!name) { showToast('请输入你的昵称'); return; }

    const charData = collectMyCharData();
    if (!charData.name) {
      showToast('请先在人物卡页面创建角色（至少填写角色姓名），再创建房间');
      return;
    }

    M.playerName = name;
    M.playerId = generateUUID();
    M.isHost = true;
    M.gamePhase = 'lobby';
    M.readyPlayers = new Set();
    M.turnOrder = [M.playerId];
    M.currentTurnIndex = 0;
    M.connections = {};
    M.players = {};
    M.chatLog = [];

    M.players[M.playerId] = {
      id: M.playerId, name: M.playerName, isHost: true,
      joinedAt: Date.now(), ready: true,
      charName: charData.name,
      hp: cocState.currentHp || '?', san: cocState.san || '?',
      charData: charData
    };
    M.readyPlayers.add(M.playerId);

    localStorage.setItem('ttrpg-mp-nickname', M.playerName);

    try {
      await initPeer(null);
      M.roomId = M.peer.id;
      setupHostListeners();
      M.connected = true;
      showRoomView();
      addChatMessage('system', null, '房间已创建 — 现在是准备阶段，等待玩家加入并选择角色');
      addChatMessage('system', null, '房间号: ' + M.roomId + ' — 点击右上角复制分享给好友');
      renderAllRoom();
      startHeartbeat();
      showToast('房间已创建! 将房间号分享给好友即可联机。');
      document.getElementById('mpInput')?.removeAttribute('disabled');
      document.getElementById('mpSendBtn')?.removeAttribute('disabled');
    } catch (err) {
      showToast('创建房间失败: ' + err.message);
      connCleanup();
    }
  },

  // ── Join Room ────────────────────────────────────
  async joinRoom() {
    const nameInput = document.getElementById('mpJoinName');
    const roomInput = document.getElementById('mpJoinRoomId');
    const name = (nameInput?.value?.trim()) || ('调查员' + Math.floor(Math.random() * 9000 + 1000));
    const roomId = roomInput?.value?.trim();

    if (!name) { showToast('请输入你的昵称'); return; }
    if (!roomId) { showToast('请输入房间号'); return; }

    const charData = collectMyCharData();
    if (!charData.name) {
      showToast('请先在人物卡页面创建角色（至少填写角色姓名），再加入房间');
      return;
    }

    M.playerName = name;
    M.playerId = generateUUID();
    M.isHost = false;
    M.roomId = roomId;
    M.gamePhase = 'lobby';
    M.readyPlayers = new Set();
    M.turnOrder = [];
    M.currentTurnIndex = 0;
    M.hostConn = null;
    M.chatLog = [];
    M.reconnectHostId = roomId;

    localStorage.setItem('ttrpg-mp-nickname', M.playerName);

    try {
      await initPeer(null);
      setupClientListeners();
      await connectToHost(roomId);
    } catch (err) {
      showToast('加入房间失败: ' + err.message);
      connCleanup();
    }
  },

  // ── Leave ────────────────────────────────────────
  leaveRoom() {
    if (!confirm('确定要离开当前房间吗？')) return;
    if (M.isHost) broadcastToAll({ type: 'system', content: '🏚️ 房主已关闭房间' });
    connCleanup();
    showLobbyView();
    showToast('已离开房间');
  },

  // ── Send Message ─────────────────────────────────
  sendMessage() {
    const input = document.getElementById('mpInput');
    if (!input || !M.connected) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const mode = M.inputMode;
    const pn = M.playerName;
    const pid = M.playerId;

    switch (mode) {
      case 'public': {
        if (M.isHost) {
          addChatMessage('action', pn, text);
          broadcastToAll({ type: 'action', playerId: pid, playerName: pn, content: text });
          processHostAIAction(pid, pn, text);
        } else if (M.hostConn && M.hostConn.open) {
          M.hostConn.send({ type: 'action', playerId: pid, playerName: pn, content: text });
          addChatMessage('action', pn, text);
          renderMultiplayerChat();
        } else {
          queueMessage({ type: 'action', playerId: pid, playerName: pn, content: text });
          addChatMessage('action', pn, text);
        }
        break;
      }
      case 'secret': {
        if (M.isHost) {
          addChatMessage('secret', pn, text);
          processHostAISecret(pid, pn, text);
        } else if (M.hostConn && M.hostConn.open) {
          M.hostConn.send({ type: 'secret', playerId: pid, playerName: pn, content: text });
          addChatMessage('secret', pn, text);
          renderMultiplayerChat();
        }
        break;
      }
      case 'chat': {
        const m = { type: 'chat', playerId: pid, playerName: pn, content: text };
        if (M.isHost) { addChatMessage('chat', pn, text); broadcastToAll(m); }
        else if (M.hostConn && M.hostConn.open) {
          M.hostConn.send(m); addChatMessage('chat', pn, text); renderMultiplayerChat();
        }
        break;
      }
    }
    renderMultiplayerChat();
  },

  // ── Copy Room ID ─────────────────────────────────
  copyRoomId() {
    if (!M.roomId) return;
    navigator.clipboard?.writeText(M.roomId).then(() => {
      showToast('房间号已复制到剪贴板!');
    }).catch(() => { showToast('房间号: ' + M.roomId + ' (请手动复制)'); });
  },

  // ── End Turn ─────────────────────────────────────
  endTurn() {
    if (!M.connected || M.gamePhase !== 'playing') return;
    if (M.isHost) {
      advanceTurn();
    } else if (M.hostConn && M.hostConn.open) {
      M.hostConn.send({ type: 'end-turn', playerId: M.playerId, playerName: M.playerName });
    }
  },

  // ── Player Ready ─────────────────────────────────
  playerReady() {
    if (!M.connected || M.gamePhase !== 'lobby') return;
    const isReady = !M.readyPlayers.has(M.playerId);
    if (isReady) {
      const charData = collectMyCharData();
      if (!charData.name) {
        showToast('请先在人物卡页面创建或选择角色，填写角色姓名后再准备');
        return;
      }
      if (!charData.race && !charData.cls) {
        showToast('请至少填写角色的种族或职业信息');
        return;
      }
      M.readyPlayers.add(M.playerId);
      M.players[M.playerId].ready = true;
      M.players[M.playerId].charData = charData;
      M.players[M.playerId].charName = charData.name || '';
      M.players[M.playerId].hp = charData.hp || charData.cocHp || '?';
      M.players[M.playerId].san = charData.cocSan || '?';
    } else {
      M.readyPlayers.delete(M.playerId);
      M.players[M.playerId].ready = false;
    }
    const charData = collectMyCharData();
    if (M.isHost) {
      if (isReady) M.players[M.playerId].charData = charData;
      broadcastToAll({ type: 'ready-update', playerId: M.playerId, ready: isReady });
      broadcastToAll({ type: 'player-list', players: M.players });
    } else if (M.hostConn && M.hostConn.open) {
      M.hostConn.send({ type: 'player-ready', playerId: M.playerId, playerName: M.playerName, ready: isReady, charData: charData });
    }
    renderAllRoom();
    showToast(isReady ? '已准备就绪，等待房主开始游戏' : '已取消准备');
  },

  // ── Start Game ───────────────────────────────────
  startGame() {
    if (!M.isHost || M.gamePhase !== 'lobby') return;
    const hostData = collectMyCharData();
    if (hostData && hostData.name) {
      M.players[M.playerId].charData = hostData;
      M.players[M.playerId].charName = hostData.name;
      M.players[M.playerId].hp = hostData.hp || hostData.cocHp || '?';
    }
    handleHostMessage(null, { type: 'request-game-start', playerId: M.playerId, playerName: M.playerName });
  },

  // ── Set Input Mode ───────────────────────────────
  setInputMode(mode) {
    M.inputMode = mode;
    document.querySelectorAll('.mp-input-tab').forEach(t => t.classList.remove('active', 'secret-active'));
    const tab = document.querySelector('.mp-input-tab[data-mp-input="' + mode + '"]');
    if (tab) { tab.classList.add('active'); if (mode === 'secret') tab.classList.add('secret-active'); }
    const input = document.getElementById('mpInput');
    if (input) {
      if (mode === 'public') input.placeholder = '输入行动指令...';
      else if (mode === 'secret') input.placeholder = '秘密行动 (仅KP可见)...';
      else input.placeholder = '发送聊天消息...';
      input.focus();
    }
  },

  // ── Dice ─────────────────────────────────────────
  rollAndBroadcast(diceNotation) {
    let result, detail;
    if (!diceNotation) {
      const dice = state.currentDice || 20;
      result = Math.floor(Math.random() * dice) + 1;
      detail = 'd' + dice + ' = ' + result;
    } else {
      const m = diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
      if (!m) return;
      const count = parseInt(m[1]) || 1;
      const sides = parseInt(m[2]);
      const mod = parseInt(m[3]) || 0;
      const rolls = [];
      result = 0;
      for (let i = 0; i < count; i++) { const r = Math.floor(Math.random() * sides) + 1; rolls.push(r); result += r; }
      result += mod;
      detail = count > 1 ? rolls.join('+') + (mod ? (mod > 0 ? '+' + mod : mod) : '') + ' = ' + result : diceNotation + ' = ' + result;
    }
    const msg = { type: 'dice', playerId: M.playerId, playerName: M.playerName, result, detail };
    if (M.isHost) { addChatMessage('dice', M.playerName, detail); broadcastToAll(msg); }
    else if (M.hostConn && M.hostConn.open) { M.hostConn.send(msg); addChatMessage('dice', M.playerName, detail); renderMultiplayerChat(); }
    scrollChatBottom();
    return { result, detail };
  },

  // ── Status Update ────────────────────────────────
  broadcastStatusUpdate() {
    if (!M.connected) return;
    const charData = collectMyCharData();
    const update = { type: 'update-status', playerId: M.playerId, playerName: M.playerName,
      hp: cocState.currentHp, san: cocState.san, charName: charData.name || '', charData: charData };
    if (M.isHost) {
      if (M.players[M.playerId]) {
        M.players[M.playerId].hp = cocState.currentHp;
        M.players[M.playerId].san = cocState.san;
        M.players[M.playerId].charName = charData.name;
        M.players[M.playerId].charData = charData;
      }
      broadcastToAll({ type: 'player-list', players: M.players });
    } else if (M.hostConn && M.hostConn.open) {
      M.hostConn.send(update);
    }
  },
};

function scrollChatBottom() {
  const c = document.getElementById('mpKPMessages');
  if (c) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 60);
}

// ── Event listeners for internal communication ────
document.addEventListener('mp-generate-intro', () => {
  generateGameStartScenario();
});

document.addEventListener('mp-process-action', (e) => {
  const { pid, dn, content } = e.detail;
  processHostAIAction(pid, dn, content);
});

document.addEventListener('mp-process-secret', (e) => {
  const { pid, dn, content } = e.detail;
  processHostAISecret(pid, dn, content);
});

document.addEventListener('mp-show-room', () => showRoomView());
document.addEventListener('mp-start-heartbeat', () => startHeartbeat());
document.addEventListener('mp-stop-heartbeat', () => stopHeartbeat());
document.addEventListener('mp-conn-dot', (e) => updateConnDot(e.detail));
document.addEventListener('mp-reconnect-toast', (e) => showReconnectToast(e.detail.msg, e.detail.error));
document.addEventListener('mp-reconnect-dismiss', () => dismissReconnectToast());
document.addEventListener('mp-apply-char', (e) => applyCharDataToSheet(e.detail));
document.addEventListener('mp-refresh-ui', () => refreshUI());
document.addEventListener('mp-host-disconnect', () => {
  if (M.reconnectAttempts < M.maxReconnectAttempts && M.reconnectHostId) {
    attemptReconnect();
  } else {
    showReconnectToast('连接已断开，请重新加入房间', true);
  }
});
document.addEventListener('mp-connect-host', (e) => {
  connectToHost(e.detail).catch(() => {});
});

// Multiplayer input mode tabs
document.addEventListener('click', function(e) {
  const tab = e.target.closest('.mp-input-tab');
  if (tab) {
    Multiplayer.setInputMode(tab.dataset.mpInput);
  }
  const lobbyTab = e.target.closest('.mp-tab');
  if (lobbyTab) {
    document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mp-tab-panel').forEach(p => p.classList.remove('active'));
    lobbyTab.classList.add('active');
    const panelId = lobbyTab.dataset.mpTab === 'create' ? 'mpTabCreate' : 'mpTabJoin';
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
  }
});

// Multiplayer input Enter key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    const input = document.getElementById('mpInput');
    if (input && document.activeElement === input) {
      e.preventDefault();
      Multiplayer.sendMessage();
    }
  }
});
