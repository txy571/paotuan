// ==================== MULTIPLAYER: CLIENT MESSAGE HANDLING ====================
import { state, THEME_NAMES, cocState } from '../state.js';
import { showToast } from '../utils.js';
import { M, applyCharDataToSheet, applyGameState, initPeer, collectMyCharData } from './connection.js';
import { addChatMessage, renderAllRoom } from './ui.js';
import { selectRPG } from '../theme.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';

// ── Connect to Host ────────────────────────────────
export function connectToHost(hostId) {
  return new Promise((resolve, reject) => {
    const conn = M.peer.connect(hostId, { reliable: true, serialization: 'json' });
    const timeout = setTimeout(() => {
      reject(new Error('连接房间超时。请确认: 1)房间号正确 2)房主在线 3)双方网络可直连。提示: 请房主复制完整房间号(含连字符)'));
    }, 30000);

    conn.on('open', () => {
      clearTimeout(timeout);
      M.hostConn = conn;
      const charData = collectMyCharData();
      conn.send({
        type: 'hello', playerId: M.playerId, playerName: M.playerName,
        characterName: charData.name || '', hp: cocState.currentHp || '?',
        san: cocState.san || '?', charData: charData
      });
      M.connected = true;
      document.dispatchEvent(new CustomEvent('mp-show-room'));
      document.dispatchEvent(new CustomEvent('mp-start-heartbeat'));
      document.getElementById('mpInput')?.removeAttribute('disabled');
      document.getElementById('mpSendBtn')?.removeAttribute('disabled');
      showToast('已加入房间 ' + M.roomId + '! 请在准备阶段选择角色并点击准备。');
      resolve();
    });

    conn.on('data', (data) => handleClientMessage(data));
    conn.on('close', () => handleHostDisconnect());
    conn.on('error', (err) => {
      clearTimeout(timeout);
      if (!M.connected) {
        reject(new Error('无法连接到房主: ' + (err.message || '未知错误。可能双方网络无法直连，请尝试使用同一局域网。')));
      } else {
        handleHostDisconnect();
      }
    });
    M.hostConn = conn;
  });
}

// ── Client Listeners ───────────────────────────────
export function setupClientListeners() {
  if (!M.peer) return;
  M.peer.on('connection', (conn) => {
    conn.on('data', (data) => handleClientMessage(data));
  });
}

// ── Handle Client Messages ─────────────────────────
function handleClientMessage(data) {
  if (!data || !data.type) return;
  switch (data.type) {
    case 'welcome': {
      M.players = data.players || {};
      if (!M.players[M.playerId]) {
        M.players[M.playerId] = { id: M.playerId, name: M.playerName, isHost: false, joinedAt: Date.now(), ready: false };
      }
      if (data.chatLog) M.chatLog = data.chatLog;
      if (data.gameState) applyGameState(data.gameState);
      if (data.gamePhase) M.gamePhase = data.gamePhase;
      if (data.turnOrder) M.turnOrder = data.turnOrder;
      if (data.currentTurnIndex !== undefined) M.currentTurnIndex = data.currentTurnIndex;
      if (data.theme && data.theme !== state.theme) selectRPG(data.theme);
      document.dispatchEvent(new CustomEvent('mp-refresh-ui'));
      renderAllRoom();
      break;
    }

    case 'game-start': {
      M.gamePhase = 'playing';
      M.turnOrder = data.turnOrder || [];
      M.currentTurnIndex = data.currentTurnIndex || 0;
      if (data.players) M.players = data.players;
      const cp = M.turnOrder[M.currentTurnIndex];
      const cpName = M.players[cp]?.name || '?';
      addChatMessage('system', null, '游戏开始!');
      addChatMessage('system', null, '🔔 当前轮到: ' + cpName);
      renderAllRoom();
      break;
    }

    case 'turn-change':
    case 'turn-sync': {
      if (data.turnOrder) M.turnOrder = data.turnOrder;
      if (data.currentTurnIndex !== undefined) M.currentTurnIndex = data.currentTurnIndex;
      const cp = M.turnOrder[M.currentTurnIndex];
      const cpName = data.currentPlayerName || M.players[cp]?.name || '?';
      if (data.type === 'turn-change') addChatMessage('system', null, '轮到: ' + cpName);
      renderAllRoom();
      break;
    }

    case 'ready-update': {
      if (M.players[data.playerId]) {
        M.players[data.playerId].ready = data.ready;
        if (data.ready) M.readyPlayers.add(data.playerId);
        else M.readyPlayers.delete(data.playerId);
      }
      renderAllRoom();
      break;
    }

    case 'player-joined': {
      M.players[data.playerId] = { id: data.playerId, name: data.playerName, isHost: false,
        joinedAt: Date.now(), ready: false, charName: data.charData?.name || '', hp: '?', san: '?' };
      addChatMessage('system', null, '👋 ' + data.playerName + ' 加入了房间');
      renderAllRoom();
      break;
    }

    case 'player-left': {
      delete M.players[data.playerId];
      M.readyPlayers.delete(data.playerId);
      M.turnOrder = M.turnOrder.filter(id => id !== data.playerId);
      addChatMessage('system', null, '👋 ' + data.playerName + ' 离开了房间');
      renderAllRoom();
      break;
    }

    case 'player-list': {
      const self = M.players[M.playerId];
      M.players = data.players || {};
      if (self && !M.players[M.playerId]) M.players[M.playerId] = self;
      renderAllRoom();
      break;
    }

    case 'action':
      addChatMessage('action', data.playerName, data.content);
      break;
    case 'chat':
      addChatMessage('chat', data.playerName, data.content);
      break;
    case 'dice':
      addChatMessage('dice', data.playerName, data.detail || data.result);
      break;
    case 'kp-response':
      addChatMessage(data.isError ? 'kp-error' : 'kp', THEME_NAMES[state.theme] + ' 主持人', data.content);
      break;
    case 'kp-secret-response':
      addChatMessage('secret-kp', 'KP (秘密)', data.content);
      break;
    case 'system':
    case 'system-msg':
      addChatMessage('system', null, data.content);
      break;

    case 'game-state': {
      if (data.gameState) applyGameState(data.gameState);
      if (data.players) M.players = data.players;
      if (data.chatLog) M.chatLog = data.chatLog;
      if (data.gamePhase) M.gamePhase = data.gamePhase;
      if (data.turnOrder) M.turnOrder = data.turnOrder;
      if (data.currentTurnIndex !== undefined) M.currentTurnIndex = data.currentTurnIndex;
      if (data.theme && data.theme !== state.theme) { selectRPG(data.theme); }
      renderAllRoom();
      break;
    }

    case 'char-sync': {
      if (data.charData) applyCharDataToSheet(data.charData);
      if (data.cocState) {
        Object.assign(cocState, data.cocState);
        renderCocStatus(); renderCocChronicle();
      }
      showToast('角色数据已同步');
      break;
    }
  }
}

// ── Host Disconnect ────────────────────────────────
function handleHostDisconnect() {
  M.connected = false;
  document.dispatchEvent(new CustomEvent('mp-conn-dot', { detail: 'disconnected' }));
  document.dispatchEvent(new CustomEvent('mp-stop-heartbeat'));
  addChatMessage('system', null, '与房主的连接已断开');
  document.dispatchEvent(new CustomEvent('mp-host-disconnect'));
}
