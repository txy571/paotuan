// ==================== MULTIPLAYER: CoC 7e COMBAT MANAGER ====================
// DEX-based initiative, 60s timeout per turn, counter-attack, dodge,
// outnumbered bonus dice, firearm malfunction, impalement damage.
import { M, sendToRelay } from './connection.js';
import { addChatMessage } from './ui.js';

// ── Start Combat ────────────────────────────────────
export function startCombat(initiativeData) {
  // Sort by DEX descending
  const initiative = initiativeData.sort((a, b) => b.dex - a.dex);

  M.gamePhase = 'combat';
  M.combatState = {
    round: 1,
    initiative,
    currentIndex: 0,
    actionCounts: {},     // playerId → { attacks: 0, dodges: 0 }
    timeouts: {},
  };

  const order = initiative.map(e => `${e.name}(DEX${e.dex})`).join(' → ');
  addChatMessage('system', null, '⚔ 进入战斗阶段! 行动顺序(DEX): ' + order);
  broadcastCombat({ type: 'combat-start', initiative, round: 1, order });
  startCombatTurn();
}

// ── Start a single combat turn ──────────────────────
function startCombatTurn() {
  const cs = M.combatState;
  if (!cs) return;
  const current = cs.initiative[cs.currentIndex];
  if (!current) { endCombat('战斗结束'); return; }

  broadcastCombat({
    type: 'combat-turn-start',
    playerId: current.playerId,
    playerName: current.name,
    round: cs.round,
    index: cs.currentIndex,
    total: cs.initiative.length,
    timeout: 60,
  });

  // 60-second timeout
  cs.timeouts[current.playerId] = setTimeout(() => {
    skipCombatTurn(current.playerId, '稍作停顿——' + current.name + '在犹豫中错过了行动的时机。');
  }, 60000);
}

// ── Skip a combat turn (timeout) ────────────────────
export function skipCombatTurn(playerId, narration) {
  const cs = M.combatState;
  if (!cs) return;
  clearCombatTimeout(playerId);
  addChatMessage('system', null, narration);
  broadcastCombat({ type: 'combat-turn-skip', playerId, narration });
  advanceCombatTurn();
}

// ── Advance to next combatant ───────────────────────
export function advanceCombatTurn() {
  const cs = M.combatState;
  if (!cs) return;
  cs.currentIndex++;
  if (cs.currentIndex >= cs.initiative.length) {
    // Round complete — reset per-round counters
    cs.round++;
    cs.currentIndex = 0;
    cs.actionCounts = {};
    addChatMessage('system', null, '--- 第 ' + cs.round + ' 回合 ---');
    broadcastCombat({ type: 'combat-round', round: cs.round });
  }
  startCombatTurn();
}

// ── End combat ──────────────────────────────────────
export function endCombat(reason) {
  const cs = M.combatState;
  if (!cs) return;
  // Clear all timeouts
  Object.values(cs.timeouts).forEach(t => clearTimeout(t));
  if (M.turnTimeout) { clearTimeout(M.turnTimeout); M.turnTimeout = null; }
  M.combatState = null;
  M.gamePhase = 'exploration';
  addChatMessage('system', null, '战斗结束: ' + (reason || '已解决'));
  broadcastCombat({ type: 'combat-end', reason });
}

// ── Clear timeout for a specific player ─────────────
export function clearCombatTimeout(playerId) {
  if (M.combatState?.timeouts[playerId]) {
    clearTimeout(M.combatState.timeouts[playerId]);
    delete M.combatState.timeouts[playerId];
  }
}

// ── Check if a player can counter-attack ────────────
export function canCounterAttack(playerId) {
  const cs = M.combatState;
  if (!cs) return false;
  const counts = cs.actionCounts[playerId];
  return !counts || (counts.dodges || 0) < 1;
}

// ── Outnumbered bonus dice ──────────────────────────
// Attacker gets +1 bonus die per additional attacker beyond the first
export function getOutnumberedBonus(targetPlayerId, attackingPlayerIds) {
  const count = attackingPlayerIds.filter(id => id !== targetPlayerId).length;
  return Math.max(0, count - 1);
}

// ── Firearm malfunction ─────────────────────────────
export function checkFirearmMalfunction(d100Roll) {
  return d100Roll >= 96 && d100Roll <= 100;
}

// ── Impalement damage ───────────────────────────────
// max base damage + normal roll. e.g., "1d8" → 8 + 1d8
export function calcImpalementDamage(damageFormula) {
  const m = damageFormula.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!m) return Math.floor(Math.random() * 6) + 1; // fallback
  const count = parseInt(m[1]) || 1;
  const sides = parseInt(m[2]);
  const mod = parseInt(m[3]) || 0;
  const maxBase = count * sides; // max normal damage
  let normalRoll = 0;
  for (let i = 0; i < count; i++) normalRoll += Math.floor(Math.random() * sides) + 1;
  return maxBase + normalRoll + mod;
}

// ── Broadcast to all players (with phase info) ──────
function broadcastCombat(data) {
  if (M.isHost) {
    sendToRelay({ ...data, _all: true });
  }
}

// ── Parse initiative data from AI command ───────────
// Format: 【INITIATIVE: Name1:DEX1 Name2:DEX2 ...】
export function parseInitiativeCommand(value) {
  const entries = value.trim().split(/\s+/);
  const initiative = [];
  for (const entry of entries) {
    const parts = entry.split(':');
    if (parts.length >= 2) {
      initiative.push({
        playerId: findPlayerIdByName(parts[0]),
        name: parts[0],
        dex: parseInt(parts[1]) || 50,
      });
    }
  }
  return initiative;
}

function findPlayerIdByName(name) {
  for (const [id, p] of Object.entries(M.players)) {
    if (p.name === name || p.charName === name) return id;
  }
  // Fallback: use name as partial match
  for (const [id, p] of Object.entries(M.players)) {
    if (p.name?.includes(name) || p.charName?.includes(name)) return id;
  }
  return name; // fallback to raw name
}

export function isCurrentCombatant(playerId) {
  if (M.gamePhase !== 'combat' || !M.combatState) return true; // allow if not in combat
  const cs = M.combatState;
  const current = cs.initiative[cs.currentIndex];
  return current?.playerId === playerId || M.isHost;
}

export function getCurrentCombatantName() {
  if (!M.combatState) return '';
  const current = M.combatState.initiative[M.combatState.currentIndex];
  return current?.name || '';
}
