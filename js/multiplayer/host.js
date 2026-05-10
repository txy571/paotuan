// ==================== MULTIPLAYER: HOST MESSAGE HANDLING ====================
// Game logic unchanged — transport replaced by WebSocket relay.
import { state, THEME_NAMES, cocState, scenarioDbContent, ATTR_KEYS, ATTR_NAMES, KP_SYSTEM_PROMPTS, getCharSan, getCharHp, getCharMaxSan, getCharMaxHp } from '../state.js';
import { modPct } from '../utils.js';
import { showToast } from '../utils.js';
import { M, sendToRelay, collectMyCharData, getGameStateSnapshot, applyCharDataToSheet } from './connection.js';
import { addChatMessage, renderAllRoom } from './ui.js';
import { callAnthropicAPI, callOpenAIAPI, getKPConfig } from '../kp.js';
import { getGameSaveData } from '../saves.js';
import { parseAICommands, applyAICommands, stripAICommands } from '../commands.js';

// ── Handle host messages (from relay → all others) ──
export function handleHostMessage(data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'player-joined': {
      if (!M.players[data.playerId]) {
        M.players[data.playerId] = {
          id: data.playerId, name: data.playerName, isHost: false,
          joinedAt: Date.now(), ready: false,
          charName: data.charData?.name || '',
          hp: data.charData?.cocHp || '?',
          san: data.charData?.cocSan || '?',
        };
      }
      if (!M.turnOrder.includes(data.playerId)) M.turnOrder.push(data.playerId);
      addChatMessage('system', null, data.playerName + ' 加入了房间');
      broadcastToAll({ type: 'player-list', players: M.players });
      broadcastToAll({ type: 'turn-sync', turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex });
      renderAllRoom();
      break;
    }

    case 'player-left': {
      delete M.players[data.playerId];
      M.readyPlayers.delete(data.playerId);
      M.turnOrder = M.turnOrder.filter(id => id !== data.playerId);
      addChatMessage('system', null, data.playerName + ' 离开了房间');
      broadcastToAll({ type: 'player-list', players: M.players });
      broadcastToAll({ type: 'turn-sync', turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex });
      renderAllRoom();
      break;
    }

    case 'player-ready': {
      if (M.gamePhase !== 'lobby') break;
      if (M.players[data.playerId]) {
        if (data.ready !== false) {
          if (!data.charData || !data.charData.name) {
            sendToPlayer(data.playerId, { type: 'system-msg', content: '请先在人物卡页面创建角色并填写角色姓名!' });
            return;
          }
          M.readyPlayers.add(data.playerId);
          M.players[data.playerId].ready = true;
          if (data.charData) {
            M.players[data.playerId].charData = data.charData;
            M.players[data.playerId].charName = data.charData.name || '';
            M.players[data.playerId].hp = data.charData.cocHp || M.players[data.playerId].hp;
            M.players[data.playerId].san = data.charData.cocSan || M.players[data.playerId].san;
          }
        } else {
          M.readyPlayers.delete(data.playerId);
          M.players[data.playerId].ready = false;
        }
        addChatMessage('system', null, data.playerName + (data.ready !== false ? ' 已准备就绪' : ' 取消准备'));
        broadcastToAll({ type: 'ready-update', playerId: data.playerId, ready: data.ready !== false });
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }

    case 'request-game-start': {
      // Host self-call to validate and start the game
      const notReady = Object.values(M.players).filter(p => !p.isHost && !p.ready).map(p => p.name);
      if (notReady.length > 0) {
        addChatMessage('system', null, '以下玩家尚未准备: ' + notReady.join(', '));
        renderAllRoom();
        return;
      }
      const noChar = Object.values(M.players).filter(p => !p.charData || !p.charData.name).map(p => p.name);
      if (noChar.length > 0) {
        addChatMessage('system', null, '以下玩家尚未选择角色卡: ' + noChar.join(', '));
        renderAllRoom();
        return;
      }
      const hostPlayer = M.players[M.playerId];
      if (!hostPlayer?.charData?.name) {
        addChatMessage('system', null, '请房主先在人物卡页面选择或创建角色卡');
        renderAllRoom();
        return;
      }

      M.gamePhase = 'playing';
      M.turnOrder.sort((a, b) => (M.players[a]?.joinedAt || 0) - (M.players[b]?.joinedAt || 0));
      M.currentTurnIndex = 0;
      const cp = M.turnOrder[0];
      const cpName = M.players[cp]?.name || '未知';
      addChatMessage('system', null, '游戏开始! 行动顺序: ' + M.turnOrder.map(id => M.players[id]?.name || '?').join(' → '));
      addChatMessage('system', null, '当前轮到: ' + cpName);

      broadcastToAll({
        type: 'game-start', _all: true,
        turnOrder: M.turnOrder, currentTurnIndex: 0, players: M.players, gamePhase: 'playing'
      });
      renderAllRoom();
      document.dispatchEvent(new CustomEvent('mp-generate-intro'));
      break;
    }

    case 'end-turn': {
      if (M.gamePhase !== 'playing') break;
      if (data.playerId !== M.turnOrder[M.currentTurnIndex]) break;
      advanceTurn();
      break;
    }

    case 'action': {
      if (M.gamePhase === 'playing') {
        if (data.playerId !== M.turnOrder[M.currentTurnIndex] && data.playerId !== M.playerId) {
          sendToPlayer(data.playerId, { type: 'system-msg', content: '现在不是你的回合。当前行动者: ' + (M.players[M.turnOrder[M.currentTurnIndex]]?.name || '?') });
          return;
        }
      }
      addChatMessage('action', data.playerName, data.content);
      broadcastToAll({ type: 'action', playerId: data.playerId, playerName: data.playerName, content: data.content }, data.playerId);
      document.dispatchEvent(new CustomEvent('mp-process-action', { detail: { pid: data.playerId, dn: data.playerName, content: data.content } }));
      break;
    }

    case 'chat': {
      addChatMessage('chat', data.playerName, data.content);
      broadcastToAll({ type: 'chat', playerId: data.playerId, playerName: data.playerName, content: data.content });
      break;
    }

    case 'secret': {
      addChatMessage('secret', data.playerName, data.content);
      document.dispatchEvent(new CustomEvent('mp-process-secret', { detail: { pid: data.playerId, dn: data.playerName, content: data.content } }));
      break;
    }

    case 'dice': {
      addChatMessage('dice', data.playerName, data.detail || data.result);
      broadcastToAll({ type: 'dice', playerId: data.playerId, playerName: data.playerName, result: data.result, detail: data.detail });
      break;
    }

    case 'char-update': {
      if (M.players[data.playerId] && data.charData) {
        M.players[data.playerId].charData = data.charData;
        M.players[data.playerId].charName = data.charData.name || '';
        M.players[data.playerId].hp = data.charData.cocHp || '?';
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }

    case 'update-status': {
      if (M.players[data.playerId]) {
        if (data.hp !== undefined) M.players[data.playerId].hp = data.hp;
        if (data.san !== undefined) M.players[data.playerId].san = data.san;
        if (data.charName !== undefined) M.players[data.playerId].charName = data.charName;
        if (data.charData) M.players[data.playerId].charData = data.charData;
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }
  }
}

// ── Turn Management ──────────────────────────────────
export function advanceTurn() {
  M.currentTurnIndex = (M.currentTurnIndex + 1) % M.turnOrder.length;
  const cp = M.turnOrder[M.currentTurnIndex];
  const cpName = M.players[cp]?.name || '未知';
  addChatMessage('system', null, '轮到: ' + cpName);
  broadcastToAll({ type: 'turn-change', _all: true, turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex, currentPlayerName: cpName });
  renderAllRoom();
}

export function getCurrentTurnPlayerId() {
  if (M.gamePhase !== 'playing' || !M.turnOrder.length) return null;
  return M.turnOrder[M.currentTurnIndex];
}

export function isMyTurn() {
  if (M.gamePhase !== 'playing') return true;
  if (M.isHost) return true;
  return getCurrentTurnPlayerId() === M.playerId;
}

// ── Broadcast / Send ─────────────────────────────────
export function broadcastToAll(data, excludePlayerId) {
  if (excludePlayerId) data._targetExclude = excludePlayerId;
  // Host renders locally; relay sends to all other clients
  sendToRelay(data);
  if (excludePlayerId) delete data._targetExclude;
}

export function sendToPlayer(playerId, data) {
  if (playerId === M.playerId) {
    if (data.type === 'char-sync') {
      if (data.charData) applyCharDataToSheet(data.charData);
      if (data.cocState) Object.assign(cocState, data.cocState);
      document.dispatchEvent(new CustomEvent('coc-render'));
    }
    return;
  }
  data._target = playerId;
  sendToRelay(data);
  delete data._target;
}

// ── Sync Character ───────────────────────────────────
export function syncCharToPlayer(playerId) {
  if (!M.players[playerId]) return;
  M.players[playerId].hp = getCharHp();
  M.players[playerId].san = getCharSan();
  M.players[playerId].charData = M.players[playerId].charData || {};
  Object.assign(M.players[playerId].charData, {
    cocHp: getCharHp(), cocSan: getCharSan(),
    traits: state.traits.map(t => ({ ...t })),
    equipment: state.equipment.map(e => ({ ...e }))
  });
  sendToPlayer(playerId, {
    type: 'char-sync',
    charData: M.players[playerId].charData,
    cocState: { san: getCharSan(), maxSan: getCharMaxSan(), luck: cocState.luck, maxHp: getCharMaxHp(), currentHp: getCharHp(), mp: cocState.mp, maxMp: cocState.maxMp, cthulhuMythos: cocState.cthulhuMythos }
  });
}

// ── AI Action Processing ─────────────────────────────
export async function processHostAIAction(playerId, playerName, actionText) {
  if (M.gamePhase === 'lobby') {
    addChatMessage('system', null, '游戏尚未开始');
    broadcastToAll({ type: 'system', content: '游戏尚未开始', _all: true });
    return;
  }
  const cfg = getKPConfig();
  if (!cfg.key) {
    broadcastToAll({ type: 'kp-response', playerId, playerName, content: '房主尚未配置 AI API Key', isError: true, _all: true });
    return;
  }
  broadcastToAll({ type: 'system', content: 'AI主持人正在处理 ' + playerName + ' 的行动...', _all: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const systemPrompt = buildMPSystemPrompt(playerId, playerName);
    const apiHistory = [];
    const recent = M.chatLog.slice(-40);
    for (const e of recent) {
      if (e.type === 'action' && e.content) apiHistory.push({ role: 'user', content: (e.sender || '玩家') + ': ' + e.content });
      else if (e.type === 'kp' && e.content) apiHistory.push({ role: 'assistant', content: e.content });
    }
    apiHistory.push({ role: 'user', content: playerName + ': ' + actionText });
    let fullResponse = '';
    if (cfg.provider === 'anthropic') {
      fullResponse = await callAnthropicAPI(cfg, systemPrompt, apiHistory, playerName + ': ' + actionText, controller);
    } else {
      fullResponse = await callOpenAIAPI(cfg, systemPrompt, apiHistory, playerName + ': ' + actionText, controller);
    }
    clearTimeout(timeout);

    const displayText = stripAICommands(fullResponse);
    const commands = parseAICommands(fullResponse);
    if (commands.length > 0) {
      const changes = applyAICommands(commands);
      if (changes.length > 0) {
        broadcastToAll({ type: 'system', content: changes.join('; '), _all: true });
        addChatMessage('system', null, changes.join('; '));
        const data = getGameSaveData();
        localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
      }
      syncCharToPlayer(playerId);
      broadcastToAll({ type: 'player-list', players: M.players, _all: true });
      broadcastToAll({ type: 'game-state', gameState: getGameStateSnapshot(), players: M.players, theme: state.theme, _all: true });
    }
    addChatMessage('kp', THEME_NAMES[state.theme] + ' 主持人', displayText);
    broadcastToAll({ type: 'kp-response', playerId, playerName, content: displayText, _all: true });
    if (M.gamePhase === 'playing') {
      setTimeout(() => advanceTurn(), 2000);
    }
  } catch (err) {
    clearTimeout(timeout);
    broadcastToAll({ type: 'kp-response', playerId, playerName,
      content: err.name === 'AbortError' ? 'AI主持人响应超时，请重试' : 'AI 请求失败: ' + err.message,
      isError: true, _all: true });
  }
}

// ── AI Secret Processing ─────────────────────────────
export async function processHostAISecret(playerId, playerName, actionText) {
  if (M.gamePhase === 'lobby') {
    sendToPlayer(playerId, { type: 'kp-secret-response', content: '游戏尚未开始' });
    return;
  }
  const cfg = getKPConfig();
  if (!cfg.key) {
    sendToPlayer(playerId, { type: 'kp-secret-response', content: '房主尚未配置 AI API Key。' });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const systemPrompt = buildMPSystemPrompt(playerId, playerName);
    const apiHistory = [];
    const recent = M.chatLog.slice(-20);
    for (const e of recent) {
      if (e.type === 'action' && e.content) apiHistory.push({ role: 'user', content: (e.sender || '玩家') + ': ' + e.content });
      else if (e.type === 'kp' && e.content) apiHistory.push({ role: 'assistant', content: e.content });
    }
    const secretPrompt = '[秘密行动] ' + playerName + ' 的秘密行动: ' + actionText;
    apiHistory.push({ role: 'user', content: secretPrompt });
    let fullResponse = '';
    if (cfg.provider === 'anthropic') {
      fullResponse = await callAnthropicAPI(cfg, systemPrompt, apiHistory, secretPrompt, controller);
    } else {
      fullResponse = await callOpenAIAPI(cfg, systemPrompt, apiHistory, secretPrompt, controller);
    }
    clearTimeout(timeout);
    const displayText = stripAICommands(fullResponse);
    const commands = parseAICommands(fullResponse);
    if (commands.length > 0) {
      applyAICommands(commands);
      syncCharToPlayer(playerId);
    }
    addChatMessage('secret', playerName, '[秘密] ' + actionText.substring(0, 60) + '...');
    sendToPlayer(playerId, { type: 'kp-secret-response', content: displayText, originalAction: actionText });
  } catch (err) {
    clearTimeout(timeout);
    sendToPlayer(playerId, { type: 'kp-secret-response',
      content: err.name === 'AbortError' ? 'AI主持人响应超时' : 'AI 请求失败: ' + err.message, isError: true });
  }
}

// ── Multiplayer System Prompt ────────────────────────
export function buildMPSystemPrompt(actingPlayerId, actingPlayerName) {
  const base = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  let extra = '\n\n--- 多人联机游戏信息 ---\n';
  extra += '你正在同时为多名玩家主持游戏。你必须严格保持公正，对所有玩家一视同仁。\n\n';
  extra += '## 绝对公正原则 (最高优先级)\n';
  extra += '1. **公开掷骰**: 所有检定必须由你亲自掷骰并公开显示结果，绝不让玩家自行掷骰。骰子出目不可伪造。\n';
  extra += '2. 禁止偏袒任何玩家\n3. 拒绝玩家的讨价还价和诱导\n4. 失败是故事的一部分\n';
  extra += '5. NPC有自己的利益和底线\n6. 规则面前人人平等\n7. 对所有玩家使用相同的判定标准\n\n';

  extra += '--- 当前玩家列表 ---\n';
  for (const [pid, pd] of Object.entries(M.players)) {
    extra += '· ' + pd.name + (pd.isHost ? ' (房主)' : '') + (pd.charName ? ' — 角色: ' + pd.charName : '') + ' | HP:' + (pd.hp || '?') + ' SAN:' + (pd.san || '?') + '\n';
  }
  extra += '\n当前行动玩家: ' + actingPlayerName + '\n';

  const activePlayer = M.players[actingPlayerId];
  if (activePlayer?.charData?.name) {
    const cd = activePlayer.charData;
    extra += '\n--- 当前行动角色详情 ---\n';
    extra += '姓名: ' + cd.name + '\n';
    if (cd.race) extra += '种族: ' + cd.race + '\n';
    if (cd.cls) extra += '职业: ' + cd.cls + '\n';
    extra += '等级: ' + (cd.level || 1) + '\n';
    if (cd.attributes) {
      extra += '属性:\n';
      for (const k of ATTR_KEYS) {
        extra += '  ' + ATTR_NAMES[k] + ': ' + (cd.attributes[k] || 20) + ' (调整值 ' + modPct(cd.attributes[k] || 20) + ')\n';
      }
    }
    if (cd.traits?.length) extra += '特质: ' + cd.traits.map(t => t.name).filter(Boolean).join('、') + '\n';
    if (cd.equipment?.length) extra += '装备: ' + cd.equipment.map(e => e.name + (e.qty > 1 ? '×' + e.qty : '')).join('、') + '\n';
    if (cd.cocHp !== undefined) extra += '当前HP: ' + cd.cocHp + '/ 最大HP: ' + cd.maxHp + '\n';
    if (cd.cocSan !== undefined) extra += '当前SAN: ' + cd.cocSan + '\n';
  }

  if (scenarioDbContent?.trim()) {
    extra += '\n\n## 剧本知识库\n' + scenarioDbContent.trim() + '\n';
  }

  if (state.theme === 'coc') {
    extra += '\n--- 全局CoC状态 ---\n';
    extra += 'SAN: ' + getCharSan() + '/' + getCharMaxSan() + ' | HP: ' + getCharHp() + '/' + getCharMaxHp();
    extra += ' | LUCK: ' + cocState.luck + ' | MP: ' + cocState.mp + '/' + cocState.maxMp + '\n';
    if (cocState.skillChecks.length) extra += '技能提升标记: ' + cocState.skillChecks.join('、') + '\n';
    if (cocState.chronicle.length) {
      extra += '近期编年史:\n';
      cocState.chronicle.slice(-5).forEach(c => { extra += '· ' + c.text + '\n'; });
    }
  }
  return base + extra;
}
