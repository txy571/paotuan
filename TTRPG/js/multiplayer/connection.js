// ==================== MULTIPLAYER: CONNECTION ====================
import { state, cocState } from '../state.js';
import { showToast } from '../utils.js';
import { selectRPG, navigateTo } from '../theme.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';
import { renderTraits, renderEquipment } from '../character.js';

// Shared state (populated by index.js)
export const M = {
  peer: null,
  hostConn: null,
  connections: {},
  isHost: false,
  roomId: null,
  playerId: null,
  playerName: '',
  players: {},
  connected: false,
  gamePhase: 'lobby',
  readyPlayers: new Set(),
  turnOrder: [],
  currentTurnIndex: 0,
  inputMode: 'public',
  chatLog: [],
  heartbeatTimer: null,
  lastHeartbeat: {},
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectTimer: null,
  reconnectHostId: null,
  messageQueue: [],
};

// ── UUID ───────────────────────────────────────────
export function generateUUID() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

// ── PeerJS Init ────────────────────────────────────
export function initPeer(id) {
  return new Promise((resolve, reject) => {
    if (M.peer) { try { M.peer.destroy(); } catch(e) {} M.peer = null; }
    const peer = new Peer(id, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        ]
      }
    });
    const timeout = setTimeout(() => {
      reject(new Error('连接信令服务器超时，请检查网络'));
    }, 15000);
    peer.on('open', (assignedId) => {
      clearTimeout(timeout);
      M.peer = peer;
      resolve(assignedId);
    });
    peer.on('error', (err) => {
      clearTimeout(timeout);
      if (err.type === 'unavailable-id') reject(new Error('房间号冲突，请重试'));
      else if (err.type === 'network') reject(new Error('网络连接失败，请检查防火墙设置'));
      else reject(new Error(err.message || 'PeerJS 错误'));
    });
    peer.on('disconnected', () => {
      if (M.connected) {
        document.dispatchEvent(new CustomEvent('mp-conn-dot', { detail: 'connecting' }));
        if (M.peer && !M.peer.destroyed) M.peer.reconnect();
      }
    });
  });
}

// ── Heartbeat ──────────────────────────────────────
export function startHeartbeat() {
  stopHeartbeat();
  M.heartbeatTimer = setInterval(() => {
    if (!M.connected) return;
    if (M.isHost) {
      const now = Date.now();
      for (const [pid, pd] of Object.entries(M.players)) {
        if (pd.isHost) continue;
        if (now - (M.lastHeartbeat[pid] || 0) > 35000) {
          document.dispatchEvent(new CustomEvent('mp-disconnect', { detail: { remoteId: pd.connId } }));
        }
      }
    } else {
      if (M.hostConn && M.hostConn.open) {
        M.hostConn.send({ type: 'heartbeat', playerId: M.playerId, playerName: M.playerName, timestamp: Date.now() });
      }
    }
  }, 8000 + Math.random() * 2000);
}

export function stopHeartbeat() {
  if (M.heartbeatTimer) { clearInterval(M.heartbeatTimer); M.heartbeatTimer = null; }
}

// ── Connection Dot ─────────────────────────────────
export function updateConnDot(status) {
  const d = document.getElementById('mpConnDot');
  if (!d) return;
  d.className = 'mp-room-dot';
  if (status === 'disconnected') d.classList.add('disconnected');
  if (status === 'connecting') d.classList.add('connecting');
}

// ── Reconnection ──────────────────────────────────
export function attemptReconnect() {
  M.reconnectAttempts++;
  const delay = Math.min(3000 * Math.pow(2, M.reconnectAttempts - 1), 30000);
  updateConnDot('connecting');
  document.dispatchEvent(new CustomEvent('mp-reconnect-toast', { detail: { msg: '连接断开，正在重连 (' + M.reconnectAttempts + '/' + M.maxReconnectAttempts + ')...', error: false } }));
  M.reconnectTimer = setTimeout(async () => {
    try {
      if (M.peer && M.peer.destroyed) {
        await initPeer(null);
        document.dispatchEvent(new CustomEvent('mp-setup-client'));
      }
      // Trigger reconnection via event
      document.dispatchEvent(new CustomEvent('mp-connect-host', { detail: M.reconnectHostId }));
    } catch (err) {
      if (M.reconnectAttempts < M.maxReconnectAttempts) attemptReconnect();
      else document.dispatchEvent(new CustomEvent('mp-reconnect-toast', { detail: { msg: '重连失败，请手动重新加入', error: true } }));
    }
  }, delay);
}

// ── Cleanup ────────────────────────────────────────
export function cleanup() {
  stopHeartbeat();
  M.reconnectAttempts = 0;
  if (M.reconnectTimer) { clearTimeout(M.reconnectTimer); M.reconnectTimer = null; }
  for (const c of Object.values(M.connections)) { try { c.close(); } catch(e) {} }
  M.connections = {};
  if (M.hostConn) { try { M.hostConn.close(); } catch(e) {} M.hostConn = null; }
  if (M.peer) { try { M.peer.destroy(); } catch(e) {} M.peer = null; }
  M.connected = false; M.isHost = false; M.gamePhase = 'lobby';
  M.players = {}; M.chatLog = []; M.roomId = null;
  M.turnOrder = []; M.currentTurnIndex = 0; M.readyPlayers = new Set();
  M.messageQueue = [];
  document.getElementById('mpInput')?.setAttribute('disabled', '');
  document.getElementById('mpSendBtn')?.setAttribute('disabled', '');
  document.dispatchEvent(new CustomEvent('mp-reconnect-dismiss'));
}

// ── Queue message ──────────────────────────────────
export function queueMessage(data) {
  if (M.messageQueue.length < 20) M.messageQueue.push(data);
}

export function flushMessageQueue() {
  while (M.messageQueue.length > 0) {
    const data = M.messageQueue.shift();
    if (M.hostConn && M.hostConn.open) M.hostConn.send(data);
  }
}

// ── Collect My Char Data ──────────────────────────
export function collectMyCharData() {
  return {
    name: document.getElementById('charName')?.value?.trim() || '',
    race: document.getElementById('charRace')?.value?.trim() || '',
    cls: document.getElementById('charClass')?.value?.trim() || '',
    level: document.getElementById('charLevel')?.value || 1,
    hp: document.getElementById('charHP')?.value || '',
    maxHp: document.getElementById('charMaxHP')?.value || '',
    ac: document.getElementById('charAC')?.value || '',
    background: document.getElementById('charBackground')?.value?.trim() || '',
    attributes: { ...state.attributes },
    skills: { ...state.skills },
    traits: state.traits.map(t => ({ ...t })),
    feats: state.feats.map(f => ({ ...f })),
    equipment: state.equipment.map(e => ({ ...e })),
    cocHp: cocState.currentHp,
    cocSan: cocState.san,
  };
}

// ── Apply Char Data ────────────────────────────────
export function applyCharDataToSheet(data) {
  if (!data) return;
  const setV = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  setV('charName', data.name);
  setV('charRace', data.race);
  setV('charClass', data.cls);
  setV('charLevel', data.level);
  setV('charHP', data.hp);
  setV('charMaxHP', data.maxHp);
  setV('charAC', data.ac);
  setV('charBackground', data.background);
  if (data.attributes) { state.attributes = data.attributes; document.dispatchEvent(new CustomEvent('character-render')); }
  if (data.skills) { state.skills = data.skills; document.dispatchEvent(new CustomEvent('character-render')); }
  if (data.traits) { state.traits = data.traits; renderTraits(); }
  if (data.feats) { state.feats = data.feats; }
  if (data.equipment) { state.equipment = data.equipment; renderEquipment(); }
  if (data.cocHp !== undefined) cocState.currentHp = data.cocHp;
  if (data.cocSan !== undefined) cocState.san = data.cocSan;
  renderCocStatus();
}

// ── Game State ─────────────────────────────────────
export function getGameStateSnapshot() {
  return {
    theme: state.theme,
    cocState: { san: cocState.san, maxSan: cocState.maxSan, luck: cocState.luck, maxHp: cocState.maxHp, currentHp: cocState.currentHp, mp: cocState.mp, maxMp: cocState.maxMp, cthulhuMythos: cocState.cthulhuMythos, chronicle: cocState.chronicle.slice(-20), skillChecks: [...cocState.skillChecks] },
    character: { name: document.getElementById('charName')?.value?.trim() || '', hp: document.getElementById('charHP')?.value || '', maxHp: document.getElementById('charMaxHP')?.value || '' }
  };
}

export function applyGameState(gs) {
  if (!gs) return;
  if (gs.cocState) {
    cocState.san = gs.cocState.san ?? cocState.san;
    cocState.maxSan = gs.cocState.maxSan ?? cocState.maxSan;
    cocState.luck = gs.cocState.luck ?? cocState.luck;
    cocState.maxHp = gs.cocState.maxHp ?? cocState.maxHp;
    cocState.currentHp = gs.cocState.currentHp ?? cocState.currentHp;
    cocState.mp = gs.cocState.mp ?? cocState.mp;
    cocState.maxMp = gs.cocState.maxMp ?? cocState.maxMp;
    cocState.cthulhuMythos = gs.cocState.cthulhuMythos ?? cocState.cthulhuMythos;
    cocState.chronicle = gs.cocState.chronicle || cocState.chronicle;
    cocState.skillChecks = gs.cocState.skillChecks || cocState.skillChecks;
    renderCocStatus(); renderCocChronicle();
  }
}
