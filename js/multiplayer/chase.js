// ==================== MULTIPLAYER: CoC 7e CHASE MANAGER ====================
// MOV-based chase rules: speed comparison, obstacle checks, CON endurance.
import { M, sendToRelay } from './connection.js';
import { addChatMessage } from './ui.js';

// ── Start Chase ─────────────────────────────────────
// Format from AI: 【CHASE: LeaderName:MOV Pursuer1Name:MOV1 Pursuer2Name:MOV2 ...】
export function startChase(data) {
  M.gamePhase = 'chase';
  M.chaseState = {
    leaderId: data.leaderId,
    pursuers: data.pursuers,       // [{ playerId, name, mov, position }]
    distance: data.distance || 5,  // abstract distance units
    round: 0,
  };

  const leader = M.players[data.leaderId];
  const leaderName = leader?.name || data.leaderId;
  const pursuerNames = data.pursuers.map(p => M.players[p.playerId]?.name || p.name).join(', ');

  addChatMessage('system', null, `🏃 追逐开始! ${leaderName} 在逃, ${pursuerNames} 在追。初始距离: ${data.distance}`);
  broadcastChase({ type: 'chase-start', chaseState: M.chaseState });
}

// ── Advance chase round ─────────────────────────────
export function advanceChaseRound() {
  const cs = M.chaseState;
  if (!cs) return;
  cs.round++;

  // MOV comparison: faster characters close distance
  const leader = M.players[cs.leaderId];
  const leaderMov = leader?.charData?.attributes?.dex || 50;

  for (const p of cs.pursuers) {
    const playerData = M.players[p.playerId];
    const pursuerMov = playerData?.charData?.attributes?.dex || 50;
    if (pursuerMov > leaderMov) {
      cs.distance = Math.max(0, cs.distance - 1);
    } else if (pursuerMov < leaderMov) {
      cs.distance += 1;
    }
  }

  broadcastChase({ type: 'chase-round', round: cs.round, distance: cs.distance });

  // Check chase end conditions
  if (cs.distance <= 0) {
    endChase('追逐者抓住了目标!');
  }
}

// ── End chase ───────────────────────────────────────
export function endChase(result) {
  M.chaseState = null;
  M.gamePhase = 'exploration';
  addChatMessage('system', null, '追逐结束: ' + result);
  broadcastChase({ type: 'chase-end', result });
}

// ── Broadcast chase updates ─────────────────────────
function broadcastChase(data) {
  if (M.isHost) {
    sendToRelay({ ...data, _all: true });
  }
}

// ── Parse chase command from AI ─────────────────────
// Format: 【CHASE: LeaderName:60 PursuerName:50】
export function parseChaseCommand(value) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const leaderParts = parts[0].split(':');
  const leaderName = leaderParts[0];
  const leaderMov = parseInt(leaderParts[1]) || 60;
  const leaderId = findPlayerIdByName(leaderName);

  const pursuers = [];
  for (let i = 1; i < parts.length; i++) {
    const [name, movStr] = parts[i].split(':');
    const mov = parseInt(movStr) || 50;
    pursuers.push({
      playerId: findPlayerIdByName(name),
      name,
      mov,
      position: i, // starting position in pursuit
    });
  }

  return { leaderId, pursuers, distance: 5 };
}

function findPlayerIdByName(name) {
  for (const [id, p] of Object.entries(M.players)) {
    if (p.name === name || p.charName === name) return id;
  }
  for (const [id, p] of Object.entries(M.players)) {
    if (p.name?.includes(name) || p.charName?.includes(name)) return id;
  }
  return name;
}
