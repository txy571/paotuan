// ==================== MULTIPLAYER: GAME START SCENARIO ====================
import { state, THEME_NAMES, KP_SYSTEM_PROMPTS, COC_ERAS } from '../state.js';
import { M } from './connection.js';
import { addChatMessage, renderMultiplayerChat } from './ui.js';
import { broadcastToAll } from './host.js';
import { callAnthropicAPI, callOpenAIAPI, getKPConfig } from '../kp.js';
import { resolveD100Check, detectCheckRequest } from '../check-resolver.js';

export async function generateGameStartScenario() {
  const cfg = getKPConfig();
  if (!cfg.key) {
    addChatMessage('system', null, '冒险即将开始... (未配置AI API Key，跳过开场叙述)');
    renderMultiplayerChat();
    return;
  }

  const allChars = Object.values(M.players)
    .filter(p => p.charData && p.charData.name)
    .map(p => {
      const cd = p.charData;
      let desc = cd.name;
      if (cd.race) desc += ' (' + cd.race + ')';
      if (cd.cls) desc += ' - ' + cd.cls;
      if (cd.level) desc += ' Lv.' + cd.level;
      if (cd.hp) desc += ' | HP:' + cd.hp;
      if (cd.san) desc += ' | SAN:' + cd.san;
      if (cd.background) desc += '\n背景: ' + cd.background;
      if (cd.traits && cd.traits.length) {
        desc += '\n特质: ' + cd.traits.map(t => t.name).filter(Boolean).join('、');
      }
      if (cd.equipment && cd.equipment.length) {
        desc += '\n装备: ' + cd.equipment.map(e => e.name + (e.qty > 1 ? '×' + e.qty : '')).join('、');
      }
      return desc;
    });

  if (allChars.length === 0) {
    addChatMessage('system', null, '冒险即将开始! 请各位玩家描述你们的行动。');
    renderMultiplayerChat();
    return;
  }

  const themeName = THEME_NAMES[state.theme] || 'TTRPG';
  let eraExtra = '';
  if (state.theme === 'coc' && state.era) {
    const era = COC_ERAS[state.era];
    if (era) {
      eraExtra = '\n时代背景: ' + era.name + '\n技术水平: ' + era.techLevel + '\n时代描述: ' + era.desc + '\n';
    }
  }
  const scenarioPrompt = '你是' + themeName + '的主持人。请为即将开始的冒险撰写一段开场叙述（约400字）。\n\n' +
    eraExtra +
    '参与角色:\n' + allChars.join('\n\n') + '\n\n' +
    '要求:\n' +
    '1. 用生动的语言描绘冒险开始的场景，将每个角色的背景自然地融入到开场中\n' +
    '2. 每个角色都应至少有1-2句与其背景、职业或特质相关的个性化叙述\n' +
    '3. 营造沉浸式氛围——让玩家立刻感受到这个世界的独特气息\n' +
    '4. 以"请描述你们各自的行动"或类似的开放式结尾引导玩家开始互动\n' +
    '5. 纯叙述文本，不要包含规则说明、检定提示或【】标记\n' +
    '6. 像讲述一个故事的开篇—有场景、有气氛、有悬念\n' +
    '\n请现在输出开场叙述:';

  const basePrompt = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  const systemPromptForIntro = basePrompt + '\n\n你现在需要输出游戏的开场叙述。请直接输出叙述文本，不要包含任何规则说明。';

  try {
    addChatMessage('system', null, 'AI主持人正在生成开场叙述...');
    renderMultiplayerChat();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let fullResponse = '';
    if (cfg.provider === 'anthropic') {
      fullResponse = await callAnthropicAPI(cfg, systemPromptForIntro, [], scenarioPrompt, controller);
    } else {
      fullResponse = await callOpenAIAPI(cfg, systemPromptForIntro, [], scenarioPrompt, controller);
    }
    clearTimeout(timeout);

    const intro = fullResponse.trim();
    addChatMessage('kp', themeName + ' 主持人', intro);
    broadcastToAll({ type: 'kp-response', playerId: M.playerId, playerName: '开篇叙述', content: intro });
    addChatMessage('system', null, '--- 冒险开始! 请各位玩家描述你们的行动 ---');
    broadcastToAll({ type: 'system', content: '--- 冒险开始! 请各位玩家描述你们的行动 ---' });
  } catch (err) {
    const fallback = '冒险正式开始! 请各位玩家描述你们的行动吧。';
    addChatMessage('kp', themeName + ' 主持人', fallback);
    broadcastToAll({ type: 'kp-response', playerId: M.playerId, playerName: '开篇叙述', content: fallback });
  }
}
