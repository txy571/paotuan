// ==================== MULTIPLAYER: HOST MESSAGE HANDLING ====================
import { state, THEME_NAMES, cocState, scenarioDbContent, ATTR_KEYS, ATTR_NAMES, KP_SYSTEM_PROMPTS } from '../state.js';
import { esc, modPct } from '../utils.js';
import { showToast } from '../utils.js';
import { M, collectMyCharData, getGameStateSnapshot, applyCharDataToSheet } from './connection.js';
import { addChatMessage, renderAllRoom } from './ui.js';
import { callAnthropicAPI, callOpenAIAPI, getKPConfig } from '../kp.js';
import { getGameSaveData } from '../saves.js';
import { parseAICommands, applyAICommands, stripAICommands } from '../commands.js';
import { selectRPG } from '../theme.js';

// ── Host Listeners ─────────────────────────────────
export function setupHostListeners() {
  if (!M.peer) return;
  M.peer.on('connection', (conn) => {
    handleNewConnection(conn);
  });
}

function handleNewConnection(conn) {
  const remoteId = conn.peer;
  conn.on('open', () => {
    conn.send({
      type: 'welcome', hostId: M.playerId, hostName: M.playerName, roomId: M.roomId,
      players: M.players, chatLog: M.chatLog.slice(-80),
      gameState: getGameStateSnapshot(), gamePhase: M.gamePhase,
      turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex, theme: state.theme
    });
  });
  conn.on('data', (data) => handleHostMessage(remoteId, data));
  conn.on('close', () => handlePlayerDisconnect(remoteId));
  conn.on('error', () => handlePlayerDisconnect(remoteId));
  M.connections[remoteId] = conn;
}

function handlePlayerDisconnect(remoteId) {
  let pid = null;
  for (const [p, d] of Object.entries(M.players)) {
    if (d.connId === remoteId || p === remoteId) { pid = p; break; }
  }
  if (pid && M.players[pid] && !M.players[pid].isHost) {
    const nm = M.players[pid].name;
    M.readyPlayers.delete(pid);
    M.turnOrder = M.turnOrder.filter(id => id !== pid);
    delete M.players[pid];
    broadcastToAll({ type: 'player-left', playerId: pid, playerName: nm });
    broadcastToAll({ type: 'player-list', players: M.players });
    broadcastToAll({ type: 'turn-sync', turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex });
    addChatMessage('system', null, nm + ' 离开了房间');
    renderAllRoom();
  }
  if (M.connections[remoteId]) { try { M.connections[remoteId].close(); } catch(e) {} delete M.connections[remoteId]; }
}

// ── Handle Host Messages ──────────────────────────
export function handleHostMessage(remoteId, data) {
  if (!data || !data.type) return;
  let pid = data.playerId;
  let pname = data.playerName || '未知玩家';

  if (data.type === 'hello') {
    pid = data.playerId; pname = data.playerName;
    const charData = data.charData || {};
    M.players[pid] = {
      id: pid, name: pname, isHost: false, connId: remoteId,
      joinedAt: Date.now(), ready: false,
      charName: charData.name || data.characterName || '',
      hp: charData.cocHp || data.hp || '?',
      san: charData.cocSan || data.san || '?',
      charData: charData
    };
    if (!M.turnOrder.includes(pid)) M.turnOrder.push(pid);
    addChatMessage('system', null, pname + (charData.name ? ' (' + charData.name + ')' : '') + ' 加入了房间');
    broadcastToAll({ type: 'player-joined', playerId: pid, playerName: pname, charData: charData });
    broadcastToAll({ type: 'player-list', players: M.players });
    broadcastToAll({ type: 'turn-sync', turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex });
    renderAllRoom();
    return;
  }

  const pinfo = M.players[pid] || {};
  const dn = pname || pinfo.name || '冒险者';

  switch (data.type) {
    case 'player-ready': {
      if (M.gamePhase !== 'lobby') return;
      if (M.players[pid]) {
        if (data.ready !== false) {
          if (!data.charData || !data.charData.name) {
            sendToPlayer(pid, { type: 'system-msg', content: '请先在人物卡页面创建角色并填写角色姓名!' });
            return;
          }
          M.readyPlayers.add(pid);
          M.players[pid].ready = true;
          if (data.charData) {
            M.players[pid].charData = data.charData;
            M.players[pid].charName = data.charData.name || M.players[pid].charName;
            M.players[pid].hp = data.charData.cocHp || M.players[pid].hp;
            M.players[pid].san = data.charData.cocSan || M.players[pid].san;
          }
        } else {
          M.readyPlayers.delete(pid);
        }
        addChatMessage('system', null, dn + (data.ready !== false ? ' 已准备就绪' : ' 取消准备'));
        broadcastToAll({ type: 'ready-update', playerId: pid, ready: data.ready !== false });
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }

    case 'request-game-start': {
      const notReady = Object.values(M.players).filter(p => !p.ready).map(p => p.name);
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
      const hostData = M.players[M.playerId]?.charData;
      if (!hostData || !hostData.name) {
        addChatMessage('system', null, '请房主先在人物卡页面选择或创建角色卡，然后重新开始游戏');
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
      broadcastToAll({ type: 'game-start', turnOrder: M.turnOrder, currentTurnIndex: 0, players: M.players });
      renderAllRoom();
      document.dispatchEvent(new CustomEvent('mp-generate-intro'));
      break;
    }

    case 'end-turn': {
      if (M.gamePhase !== 'playing') return;
      if (pid !== M.turnOrder[M.currentTurnIndex]) return;
      advanceTurn();
      break;
    }

    case 'action': {
      if (M.gamePhase === 'playing') {
        if (pid !== M.turnOrder[M.currentTurnIndex] && pid !== M.playerId) {
          sendToPlayer(pid, { type: 'system-msg', content: '现在不是你的回合，请等待。当前行动者: ' + (M.players[M.turnOrder[M.currentTurnIndex]]?.name || '?') });
          return;
        }
      }
      addChatMessage('action', dn, data.content);
      broadcastToAll({ type: 'action', playerId: pid, playerName: dn, content: data.content }, pid);
      document.dispatchEvent(new CustomEvent('mp-process-action', { detail: { pid, dn, content: data.content } }));
      break;
    }

    case 'chat': {
      const m = { type: 'chat', playerId: pid, playerName: dn, content: data.content };
      addChatMessage('chat', dn, data.content);
      broadcastToAll(m);
      break;
    }

    case 'secret': {
      addChatMessage('secret', dn, data.content);
      document.dispatchEvent(new CustomEvent('mp-process-secret', { detail: { pid, dn, content: data.content } }));
      break;
    }

    case 'dice': {
      addChatMessage('dice', dn, data.detail || data.result);
      broadcastToAll({ type: 'dice', playerId: pid, playerName: dn, result: data.result, detail: data.detail });
      break;
    }

    case 'char-update': {
      if (M.players[pid] && data.charData) {
        M.players[pid].charData = data.charData;
        M.players[pid].charName = data.charData.name || '';
        M.players[pid].hp = data.charData.hp || data.charData.cocHp || '?';
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }

    case 'request-state': {
      const c = M.connections[remoteId];
      if (c) c.send({ type: 'game-state', players: M.players, chatLog: M.chatLog.slice(-120),
        gameState: getGameStateSnapshot(), gamePhase: M.gamePhase, turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex, theme: state.theme });
      break;
    }

    case 'heartbeat': {
      M.lastHeartbeat[pid] = Date.now();
      break;
    }

    case 'update-status': {
      if (M.players[pid]) {
        if (data.hp !== undefined) M.players[pid].hp = data.hp;
        if (data.san !== undefined) M.players[pid].san = data.san;
        if (data.charName !== undefined) M.players[pid].charName = data.charName;
        if (data.charData) M.players[pid].charData = data.charData;
        broadcastToAll({ type: 'player-list', players: M.players });
        renderAllRoom();
      }
      break;
    }
  }
}

// ── Turn Management ───────────────────────────────
export function advanceTurn() {
  M.currentTurnIndex = (M.currentTurnIndex + 1) % M.turnOrder.length;
  const cp = M.turnOrder[M.currentTurnIndex];
  const cpName = M.players[cp]?.name || '未知';
  addChatMessage('system', null, '🔔 轮到: ' + cpName);
  broadcastToAll({ type: 'turn-change', turnOrder: M.turnOrder, currentTurnIndex: M.currentTurnIndex, currentPlayerName: cpName });
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

// ── Broadcast ──────────────────────────────────────
export function broadcastToAll(data, excludePlayerId) {
  for (const [cid, c] of Object.entries(M.connections)) {
    if (c && c.open) {
      if (excludePlayerId) {
        let skip = false;
        for (const [p, pd] of Object.entries(M.players)) {
          if (p === excludePlayerId && pd.connId === cid) { skip = true; break; }
        }
        if (skip) continue;
      }
      c.send(data);
    }
  }
  renderAllRoom();
}

// ── Send to Player ─────────────────────────────────
export function sendToPlayer(playerId, data) {
  if (playerId === M.playerId) {
    if (data.type === 'char-sync') {
      if (data.charData) {
        applyCharDataToSheet(data.charData);
      }
      if (data.cocState) Object.assign(cocState, data.cocState);
      document.dispatchEvent(new CustomEvent('coc-render'));
    }
    return;
  }
  const pi = M.players[playerId];
  if (!pi || !pi.connId) return;
  const c = M.connections[pi.connId];
  if (c && c.open) c.send(data);
}

// ── Sync Character ─────────────────────────────────
export function syncCharToPlayer(playerId) {
  if (!M.players[playerId]) return;
  M.players[playerId].hp = cocState.currentHp;
  M.players[playerId].san = cocState.san;
  M.players[playerId].charData = M.players[playerId].charData || {};
  Object.assign(M.players[playerId].charData, {
    cocHp: cocState.currentHp, cocSan: cocState.san,
    traits: state.traits.map(t => ({ ...t })),
    equipment: state.equipment.map(e => ({ ...e }))
  });
  sendToPlayer(playerId, {
    type: 'char-sync',
    charData: M.players[playerId].charData,
    cocState: { san: cocState.san, maxSan: cocState.maxSan, luck: cocState.luck, maxHp: cocState.maxHp, currentHp: cocState.currentHp, mp: cocState.mp, maxMp: cocState.maxMp, cthulhuMythos: cocState.cthulhuMythos }
  });
}

// ── AI Action Processing (Host) ────────────────────
export async function processHostAIAction(playerId, playerName, actionText) {
  if (M.gamePhase === 'lobby') {
    addChatMessage('system', null, '游戏尚未开始，请等待房主开始游戏后再进行行动');
    broadcastToAll({ type: 'system', content: '游戏尚未开始，请等待房主开始游戏后再进行行动' });
    return;
  }
  const cfg = getKPConfig();
  if (!cfg.key) {
    broadcastToAll({ type: 'kp-response', playerId, playerName, content: '房主尚未配置 AI API Key。请在首页配置 AI 主持人 API。', isError: true });
    return;
  }
  broadcastToAll({ type: 'system', content: 'AI主持人正在处理 ' + playerName + ' 的行动...' });

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
        broadcastToAll({ type: 'system', content: changes.join('; ') });
        addChatMessage('system', null, changes.join('; '));
        const data = getGameSaveData();
        localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
      }
      syncCharToPlayer(playerId);
      broadcastToAll({ type: 'player-list', players: M.players });
      broadcastToAll({ type: 'game-state', gameState: getGameStateSnapshot(), players: M.players, theme: state.theme });
    }
    addChatMessage('kp', THEME_NAMES[state.theme] + ' 主持人', displayText);
    broadcastToAll({ type: 'kp-response', playerId, playerName, content: displayText });
    if (M.gamePhase === 'playing') {
      setTimeout(() => advanceTurn(), 2000);
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      broadcastToAll({ type: 'kp-response', playerId, playerName, content: 'AI主持人响应超时，请重试', isError: true });
    } else {
      broadcastToAll({ type: 'kp-response', playerId, playerName, content: 'AI 请求失败: ' + err.message, isError: true });
    }
  }
}

// ── AI Secret Processing (Host) ────────────────────
export async function processHostAISecret(playerId, playerName, actionText) {
  if (M.gamePhase === 'lobby') {
    sendToPlayer(playerId, { type: 'kp-secret-response', content: '游戏尚未开始，请等待房主开始游戏后再使用秘密行动' });
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
    const secretPrompt = '[秘密行动 - 仅此玩家与KP可见] ' + playerName + ' 的秘密行动: ' + actionText;
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
    sendToPlayer(playerId, { type: 'kp-secret-response', content: err.name === 'AbortError' ? 'AI主持人响应超时' : 'AI 请求失败: ' + err.message, isError: true });
  }
}

// ── Multiplayer System Prompt ──────────────────────
export function buildMPSystemPrompt(actingPlayerId, actingPlayerName) {
  const base = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  let extra = '\n\n--- 多人联机游戏信息 ---\n';
  extra += '你正在同时为多名玩家主持游戏。你必须严格保持公正，对所有玩家一视同仁。\n\n';
  extra += '## ⚖️ 绝对公正原则 (最高优先级)\n';
  extra += '1. **禁止偏袒**: 你不得因为任何玩家的言语请求而改变游戏规则、降低难度、或给予特殊待遇。\n';
  extra += '2. **拒绝诱导**: 玩家可能会说"请让我成功"、"放我一马"、"给我一个机会"。你必须完全无视这些请求。\n';
  extra += '3. **保护游戏性**: 过度的怜悯会毁掉跑团的乐趣。失败、受伤、甚至角色死亡都是故事的一部分。\n';
  extra += '4. **NPC自主性**: NPC有自己的利益、性格和底线，不会被玩家的花言巧语轻易说服。\n';
  extra += '5. **规则至上**: 你是规则的执行者，不是玩家的工具。\n';
  extra += '6. **一致性**: 对所有玩家使用相同的判定标准。\n\n';

  extra += '--- 当前玩家列表 ---\n';
  for (const [pid, pd] of Object.entries(M.players)) {
    extra += '· ' + pd.name + (pd.isHost ? ' (房主)' : '') + (pd.charName ? ' — 角色: ' + pd.charName : '') + ' | HP:' + (pd.hp || '?') + ' SAN:' + (pd.san || '?') + '\n';
  }
  extra += '\n当前行动玩家: ' + actingPlayerName + '\n';

  const activePlayer = M.players[actingPlayerId];
  if (activePlayer && activePlayer.charData && activePlayer.charData.name) {
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
    if (cd.traits && cd.traits.length) extra += '特质: ' + cd.traits.map(t => t.name).filter(Boolean).join('、') + '\n';
    if (cd.equipment && cd.equipment.length) extra += '装备: ' + cd.equipment.map(e => e.name + (e.qty > 1 ? '×' + e.qty : '')).join('、') + '\n';
    if (cd.cocHp !== undefined) extra += '当前HP: ' + cd.cocHp + '/ 最大HP: ' + cd.maxHp + '\n';
    if (cd.cocSan !== undefined) extra += '当前SAN: ' + cd.cocSan + '\n';
  }

  if (scenarioDbContent && scenarioDbContent.trim()) {
    extra += '\n\n## 📚 剧本知识库 (请严格参考)\n';
    extra += scenarioDbContent.trim() + '\n';
  }

  if (state.theme === 'coc') {
    extra += '\n--- 全局CoC状态 ---\n';
    extra += 'SAN: ' + cocState.san + '/' + cocState.maxSan + ' | HP: ' + cocState.currentHp + '/' + cocState.maxHp;
    extra += ' | LUCK: ' + cocState.luck + ' | MP: ' + cocState.mp + '/' + cocState.maxMp + '\n';
    if (cocState.skillChecks.length) extra += '技能提升标记: ' + cocState.skillChecks.join('、') + '\n';
    if (cocState.chronicle.length) {
      extra += '近期编年史:\n';
      cocState.chronicle.slice(-5).forEach(c => { extra += '· ' + c.text + '\n'; });
    }
  }
  return base + extra;
}
