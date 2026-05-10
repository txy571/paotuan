// ==================== MULTIPLAYER: WEBSOCKET RELAY CONNECTION ====================
// Replaces PeerJS WebRTC with Cloudflare Worker + Durable Objects WebSocket relay.
// No NAT issues, no P2P — all messages pass through the relay server.
import { state, cocState } from '../state.js';
import { showToast } from '../utils.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';
import { renderTraits, renderEquipment } from '../character.js';

// Shared state
export const M = {
  ws: null,              // WebSocket to relay
  isHost: false,
  roomId: null,          // room code
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
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectTimer: null,
  reconnectRoomId: null,
};

const RELAY_URL = 'https://paotuan.183107.xyz';

function getRelayUrl() {
  return RELAY_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

// ── UUID ────────────────────────────────────────────
export function generateUUID() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

// Short room code (6 alphanumeric chars)
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Connect to relay ─────────────────────────────────
export function connectRelay(roomCode, isHost) {
  return new Promise((resolve, reject) => {
    const base = getRelayUrl();

    const wsUrl = base + '/room/' + roomCode;
    const ws = new WebSocket(wsUrl);
    let resolved = false;

    ws.onopen = () => {
      M.ws = ws;
      // Register with the room
      ws.send(JSON.stringify({
        type: '_join',
        playerId: M.playerId,
        playerName: M.playerName,
        isHost: isHost,
        charData: collectMyCharData(),
      }));

      // Wait for welcome message
      const onMsg = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'welcome') {
            ws.removeEventListener('message', onMsg);
            M.connected = true;
            M.roomId = roomCode;
            M.isHost = isHost;
            M.players = data.players || {};
            if (!M.players[M.playerId]) {
              M.players[M.playerId] = {
                id: M.playerId, name: M.playerName, isHost: isHost,
                joinedAt: Date.now(), ready: isHost,
                charName: '', hp: cocState.currentHp || '?', san: cocState.san || '?',
              };
            }
            resolved = true;
            resolve(data);
          }
        } catch {}
      };
      ws.addEventListener('message', onMsg);

      // Timeout
      setTimeout(() => {
        if (!resolved) {
          ws.removeEventListener('message', onMsg);
          reject(new Error('加入房间超时，请检查中继服务器是否正常运行'));
        }
      }, 15000);
    };

    ws.onerror = () => {
      if (!resolved) { resolved = true; reject(new Error('无法连接中继服务器，请检查网络连接后重试。')); }
    };

    ws.onclose = (e) => {
      if (!resolved) {
        resolved = true;
        reject(new Error('中继服务器连接关闭 (code=' + e.code + ')。请检查网络连接。'));
      } else {
        M.connected = false;
        if (M.heartbeatTimer) { clearInterval(M.heartbeatTimer); M.heartbeatTimer = null; }
        document.dispatchEvent(new CustomEvent('mp-conn-dot', { detail: 'disconnected' }));
        // Auto-reconnect for non-host
        if (!isHost && M.reconnectAttempts < M.maxReconnectAttempts) {
          scheduleReconnect(roomCode);
        } else if (isHost) {
          document.dispatchEvent(new CustomEvent('mp-host-disconnect'));
        }
      }
    };
  });
}

// ── Reconnection ─────────────────────────────────────
function scheduleReconnect(roomCode) {
  M.reconnectAttempts++;
  M.reconnectRoomId = roomCode;
  const delay = Math.min(2000 * Math.pow(2, M.reconnectAttempts - 1), 20000);
  M.reconnectTimer = setTimeout(async () => {
    try {
      await connectRelay(roomCode, false);
      M.reconnectAttempts = 0;
      if (M.reconnectTimer) { clearTimeout(M.reconnectTimer); M.reconnectTimer = null; }
      document.dispatchEvent(new CustomEvent('mp-reconnect-dismiss'));
      document.dispatchEvent(new CustomEvent('mp-conn-dot', { detail: 'connected' }));
      document.dispatchEvent(new CustomEvent('mp-start-heartbeat'));
    } catch {
      if (M.reconnectAttempts < M.maxReconnectAttempts) {
        scheduleReconnect(roomCode);
      } else {
        document.dispatchEvent(new CustomEvent('mp-reconnect-toast', { detail: { msg: '重连失败，请手动重新加入房间', error: true } }));
      }
    }
  }, delay);
}

export function attemptReconnect() {
  if (M.reconnectRoomId) {
    M.reconnectAttempts = 0;
    scheduleReconnect(M.reconnectRoomId);
  }
}

// ── Heartbeat ────────────────────────────────────────
export function startHeartbeat() {
  stopHeartbeat();
  M.heartbeatTimer = setInterval(() => {
    if (!M.connected || !M.ws || M.ws.readyState !== 1) return;
    M.ws.send(JSON.stringify({ type: '_ping' }));
  }, 20000);
}

export function stopHeartbeat() {
  if (M.heartbeatTimer) { clearInterval(M.heartbeatTimer); M.heartbeatTimer = null; }
}

// ── Send ─────────────────────────────────────────────
export function sendToRelay(data) {
  if (M.ws && M.ws.readyState === 1) {
    M.ws.send(JSON.stringify(data));
  }
}

// ── Cleanup ──────────────────────────────────────────
export function cleanup() {
  stopHeartbeat();
  M.reconnectAttempts = 0;
  if (M.reconnectTimer) { clearTimeout(M.reconnectTimer); M.reconnectTimer = null; }
  if (M.ws) {
    try { M.ws.send(JSON.stringify({ type: '_leave' })); } catch {}
    try { M.ws.close(); } catch {}
    M.ws = null;
  }
  M.connected = false; M.isHost = false; M.gamePhase = 'lobby';
  M.players = {}; M.chatLog = []; M.roomId = null;
  M.turnOrder = []; M.currentTurnIndex = 0; M.readyPlayers = new Set();
  document.getElementById('mpInput')?.setAttribute('disabled', '');
  document.getElementById('mpSendBtn')?.setAttribute('disabled', '');
  document.dispatchEvent(new CustomEvent('mp-reconnect-dismiss'));
}

// ── Connection dot ───────────────────────────────────
export function updateConnDot(status) {
  const d = document.getElementById('mpConnDot');
  if (!d) return;
  d.className = 'mp-room-dot';
  if (status === 'disconnected') d.classList.add('disconnected');
  if (status === 'connecting') d.classList.add('connecting');
}

// ── Collect / Apply character data ──────────────────
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

// ── Game state snapshot ──────────────────────────────
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
