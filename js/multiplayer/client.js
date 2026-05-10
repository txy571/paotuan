// ==================== MULTIPLAYER: CLIENT MESSAGE HANDLING ====================
// Receives messages from the WebSocket relay and updates local state.
import { state, THEME_NAMES, cocState } from '../state.js';
import { M, sendToRelay, collectMyCharData, applyCharDataToSheet, applyGameState } from './connection.js';
import { addChatMessage, renderAllRoom } from './ui.js';
import { selectRPG } from '../theme.js';
import { renderCocStatus, renderCocChronicle } from '../coc-status.js';

// ── Handle messages from relay ───────────────────────
export function handleClientMessage(data) {
  if (!data || !data.type) return;
  switch (data.type) {
    case 'welcome': {
      M.players = data.players || {};
      if (!M.players[M.playerId]) {
        M.players[M.playerId] = { id: M.playerId, name: M.playerName, isHost: false, joinedAt: Date.now(), ready: false };
      }
      M.roomId = data.roomId || M.roomId;
      M.gamePhase = data.gamePhase || 'lobby';
      if (data.turnOrder) M.turnOrder = data.turnOrder;
      if (data.currentTurnIndex !== undefined) M.currentTurnIndex = data.currentTurnIndex;
      if (data.theme && data.theme !== state.theme) selectRPG(data.theme);
      renderAllRoom();
      break;
    }

    case 'game-start': {
      M.gamePhase = data.gamePhase || 'playing';
      if (data.turnOrder) M.turnOrder = data.turnOrder;
      if (data.currentTurnIndex !== undefined) M.currentTurnIndex = data.currentTurnIndex;
      if (data.players) M.players = data.players;
      const cp = M.turnOrder[M.currentTurnIndex];
      const cpName = M.players[cp]?.name || '?';
      addChatMessage('system', null, '游戏开始! ' + (M.gamePhase === 'exploration' ? '进入自由探索阶段——所有玩家可以随时行动。' : ''));
      addChatMessage('system', null, '当前轮到: ' + cpName);
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
      if (!M.players[data.playerId]) {
        M.players[data.playerId] = {
          id: data.playerId, name: data.playerName, isHost: false,
          joinedAt: Date.now(), ready: false,
          charName: data.charData?.name || '',
          hp: data.charData?.cocHp || '?',
          san: data.charData?.cocSan || '?',
        };
      }
      addChatMessage('system', null, data.playerName + ' 加入了房间');
      renderAllRoom();
      break;
    }

    case 'player-left': {
      delete M.players[data.playerId];
      M.readyPlayers.delete(data.playerId);
      M.turnOrder = M.turnOrder.filter(id => id !== data.playerId);
      addChatMessage('system', null, data.playerName + ' 离开了房间');
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
      if (data.theme && data.theme !== state.theme) selectRPG(data.theme);
      renderAllRoom();
      break;
    }

    case 'char-sync': {
      if (data.charData) applyCharDataToSheet(data.charData);
      if (data.cocState) {
        Object.assign(cocState, data.cocState);
        renderCocStatus(); renderCocChronicle();
      }
      break;
    }

    // ── CoC 7e Combat messages ──
    case 'combat-start': {
      M.gamePhase = 'combat';
      M.combatState = {
        round: data.round || 1,
        initiative: data.initiative || [],
        currentIndex: 0,
        actionCounts: {},
        timeouts: {},
      };
      addChatMessage('system', null, '⚔ 进入战斗阶段! 行动顺序(DEX): ' + (data.order || ''));
      renderAllRoom();
      break;
    }
    case 'combat-turn-start': {
      if (!M.combatState) break;
      M.combatState.currentIndex = data.index;
      M.combatState.round = data.round;
      addChatMessage('system', null, '轮到: ' + data.playerName + ' (第' + data.round + '回合)');
      renderAllRoom();
      break;
    }
    case 'combat-turn-skip': {
      if (data.narration) addChatMessage('system', null, data.narration);
      renderAllRoom();
      break;
    }
    case 'combat-round': {
      if (M.combatState) M.combatState.round = data.round;
      addChatMessage('system', null, '--- 第 ' + data.round + ' 回合 ---');
      renderAllRoom();
      break;
    }
    case 'combat-end': {
      M.gamePhase = 'exploration';
      M.combatState = null;
      addChatMessage('system', null, '战斗结束: ' + (data.reason || '已解决'));
      renderAllRoom();
      break;
    }

    // ── CoC 7e Chase messages ──
    case 'chase-start': {
      M.gamePhase = 'chase';
      M.chaseState = data.chaseState;
      const leader = M.players[data.chaseState?.leaderId];
      const leaderName = leader?.name || '?';
      addChatMessage('system', null, '🏃 追逐开始! 距离: ' + (data.chaseState?.distance || 5));
      renderAllRoom();
      break;
    }
    case 'chase-round': {
      if (M.chaseState) {
        M.chaseState.round = data.round;
        M.chaseState.distance = data.distance;
      }
      addChatMessage('system', null, '追逐第' + data.round + '轮——距离: ' + data.distance);
      renderAllRoom();
      break;
    }
    case 'chase-end': {
      M.gamePhase = 'exploration';
      M.chaseState = null;
      addChatMessage('system', null, '追逐结束: ' + (data.result || ''));
      renderAllRoom();
      break;
    }
  }
}
