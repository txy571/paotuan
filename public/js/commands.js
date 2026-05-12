// ==================== AI COMMAND PARSER ====================
import { state, cocState, scenarioMeta, setCharSan, setCharHp, getCharSan, getCharHp, getCharMaxHp } from './state.js';
import { renderTraits, renderFeats, renderEquipment } from './character.js';
import { renderCocChronicle, renderCocStatus } from './coc-status.js';
import { applyMemoryCommand } from './memory-bank.js';

// All known command types
const CMD_TYPES = 'SAN|HP|LUCK|TRAIT|REMOVE_TRAIT|CHRONICLE|SKILL_CHECK|ITEM|REMOVE_ITEM|NPC|CLUE|PLOT|MEMORY|ACT|SCENARIO_META|TASK_UPDATE|OUTLINE_UPDATE|检定请求|检定结果|掷骰请求|ACTIONS|INITIATIVE|END_COMBAT|CHASE|END_CHASE';
const CMD_RE = new RegExp(`【(${CMD_TYPES})[：:](.+?)】`);

/** Convert Arabic numerals in act names to Chinese (e.g. "第1幕" → "第一幕") */
function normalizeActCN(val) {
  const CN = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (typeof val === 'number') return CN[val] || val;
  return val.replace(/(\d+)/g, (_, d) => CN[parseInt(d)] || d);
}

export function parseAICommands(text) {
  const commands = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(CMD_RE);
    if (match) {
      commands.push({ type: match[1], value: match[2].trim(), raw: line });
    }
  }
  return commands;
}

export function applyAICommands(commands) {
  const changes = [];
  const memoryChanges = [];
  for (const cmd of commands) {
    try {
      switch (cmd.type) {
        case 'SAN': {
          const oldVal = getCharSan();
          const change = parseStatCommand(cmd.value, -1); // SAN defaults to loss
          if (change) {
            setCharSan(oldVal + change.delta);
            changes.push(`SAN: ${oldVal} → ${getCharSan()}${change.note}`);
          }
          break;
        }
        case 'HP': {
          const oldVal = getCharHp();
          const change = parseStatCommand(cmd.value, -1); // HP defaults to loss
          if (change) {
            setCharHp(oldVal + change.delta);
            changes.push(`HP: ${oldVal} → ${getCharHp()}${change.note}`);
          }
          break;
        }
        case 'LUCK': {
          const oldVal = cocState.luck;
          const delta = parseInt(cmd.value);
          if (!isNaN(delta)) {
            cocState.luck = Math.max(0, Math.min(99, cocState.luck + delta));
            changes.push(`LUCK: ${oldVal} → ${cocState.luck} (${delta >= 0 ? '+' : ''}${delta})`);
          }
          break;
        }
        case 'TRAIT': {
          const parts = cmd.value.split(/[：:]/);
          const name = parts[0]?.trim();
          const desc = parts.slice(1).join(':').trim();
          if (name) {
            const existing = state.traits.findIndex(t => t.name === name);
            if (existing >= 0) {
              state.traits[existing].desc = desc || state.traits[existing].desc;
            } else {
              state.traits.push({ name, desc: desc || '' });
            }
            changes.push(`特质: +${name}`);
            renderTraits();
            renderFeats();
          }
          break;
        }
        case 'REMOVE_TRAIT': {
          const name = cmd.value.trim();
          const idx = state.traits.findIndex(t => t.name === name);
          if (idx >= 0) {
            state.traits.splice(idx, 1);
            changes.push(`特质: -${name}`);
            renderTraits();
          }
          break;
        }
        case 'CHRONICLE': {
          cocState.chronicle.push({ time: new Date().toLocaleString(), text: cmd.value });
          changes.push(`编年史: 已记录`);
          renderCocChronicle();
          break;
        }
        case 'SKILL_CHECK': {
          const name = cmd.value.trim();
          if (!cocState.skillChecks.includes(name)) {
            cocState.skillChecks.push(name);
            changes.push(`技能提升标记: ${name}`);
          }
          break;
        }
        case 'ITEM': {
          const name = cmd.value.trim();
          if (name && !state.equipment.find(e => e.name === name)) {
            state.equipment.push({ name, qty: 1, weight: '', desc: '', equipped: false, category: '' });
            changes.push(`物品: +${name}`);
            renderEquipment();
          }
          break;
        }
        case 'REMOVE_ITEM': {
          const name = cmd.value.trim();
          const idx = state.equipment.findIndex(e => e.name === name);
          if (idx >= 0) {
            state.equipment.splice(idx, 1);
            changes.push(`物品: -${name}`);
            renderEquipment();
          }
          break;
        }
        // ── Scenario act/task tracking ──
        case 'SCENARIO_META': {
          try {
            const meta = JSON.parse(cmd.value);
            if (meta.梗概) scenarioMeta.synopsis = meta.梗概;
            if (meta.背景) scenarioMeta.background = meta.背景;
            if (meta.年代) scenarioMeta.era = meta.年代;
            if (meta.人数) scenarioMeta.playerCount = meta.人数;
            if (meta.幕数) {
              scenarioMeta.actCount = meta.幕数;
              for (let i = 1; i <= meta.幕数; i++) {
                const actName = `第${normalizeActCN(i)}幕`;
                if (!scenarioMeta.acts.find(a => a.name === actName)) {
                  scenarioMeta.acts.push({ name: actName, status: 'pending' });
                }
              }
            }
            if (meta.预估时长) scenarioMeta.estimatedDuration = meta.预估时长;
            scenarioMeta.lastUpdated = new Date().toISOString();
            changes.push(`剧本元数据已设定: ${meta.幕数 || '?'}幕`);
            import('./tracking-panel.js').then(m => m.renderTrackingPanel());
          } catch(e) { console.warn('SCENARIO_META parse error:', e); }
          break;
        }
        case 'ACT': {
          const parts = cmd.value.split(/[：:]/);
          const actName = normalizeActCN(parts[0]?.trim());
          const status = parts[1]?.trim() || 'started';
          if (actName) {
            const act = scenarioMeta.acts.find(a => a.name === actName);
            if (!act) scenarioMeta.acts.push({ name: actName, status });
            else act.status = status;
            if (status === 'started') {
              scenarioMeta.currentActName = actName;
              const idx = scenarioMeta.acts.findIndex(a => a.name === actName);
              scenarioMeta.currentAct = idx >= 0 ? idx + 1 : 0;
            }
            scenarioMeta.lastUpdated = new Date().toISOString();
            changes.push(`剧本进度: ${actName} ${status === 'completed' ? '已完成' : '开始'}`);
            import('./tracking-panel.js').then(m => m.renderTrackingPanel());
          }
          break;
        }
        case 'TASK_UPDATE': {
          const parts = cmd.value.split(/[：:]/);
          const op = parts[0]?.trim();
          const desc = parts.slice(1).join(':').trim();
          if (desc) {
            if (op === '已完成') {
              const task = scenarioMeta.tasks.find(t => t.description === desc && t.status === 'active');
              if (task) task.status = 'completed';
              else scenarioMeta.tasks.push({ id: 't_' + Date.now(), description: desc, status: 'completed', addedAt: new Date().toISOString() });
            } else {
              scenarioMeta.tasks.push({ id: 't_' + Date.now(), description: desc, status: 'active', addedAt: new Date().toISOString() });
            }
            scenarioMeta.lastUpdated = new Date().toISOString();
            changes.push(`任务已${op === '已完成' ? '完成' : '添加'}: ${desc}`);
            import('./tracking-panel.js').then(m => m.renderTrackingPanel());
          }
          break;
        }
        case 'OUTLINE_UPDATE': {
          scenarioMeta.outline = cmd.value.trim();
          scenarioMeta.lastUpdated = new Date().toISOString();
          changes.push('剧本提纲已更新');
          import('./tracking-panel.js').then(m => m.renderTrackingPanel());
          break;
        }
        // ── Memory commands ──
        case 'NPC':
        case 'CLUE':
        case 'PLOT':
        case 'MEMORY': {
          const result = applyMemoryCommand(cmd.type, cmd.value);
          if (result) memoryChanges.push(result);
          break;
        }
        // ── Dice request (handled by KP module for frontend dice UI) ──
        case '掷骰请求':
          // This is handled by kp.js, not applied here
          // The command is kept in stream so kp.js can detect it
          break;
        // ── CoC 7e game-phase commands (handled by multiplayer/check-resolver) ──
        case '检定请求':
        case '检定结果':
        case 'INITIATIVE':
        case 'END_COMBAT':
        case 'CHASE':
        case 'END_CHASE':
          // These are informational — processed by the two-pass loop or multiplayer host.
          break;
      }
    } catch(e) {
      console.warn('AI command parse error:', cmd, e);
    }
  }
  // Append memory changes to display changes (less verbose)
  if (memoryChanges.length) {
    changes.push('记忆库: ' + memoryChanges.join('; '));
  }
  return changes;
}

/**
 * Parse a stat change command value (HP/SAN).
 * Handles: plain int (-5, +10), dice with optional sign (-1d3, +2d6, d6, 1d8).
 * @param {string} raw - The command value, e.g. "-1d3", "+10", "d6", "5"
 * @param {number} defaultSign - Sign to use when no explicit sign: -1 for SAN/HP (loss), +1 for gains
 * @returns {{ delta: number, note: string } | null}
 */
function parseStatCommand(raw, defaultSign) {
  let val = raw.trim();
  let sign = 0; // 0 = not explicitly set
  if (val.startsWith('+')) { sign = 1; val = val.slice(1); }
  else if (val.startsWith('-')) { sign = -1; val = val.slice(1); }
  if (sign === 0) sign = defaultSign;

  const diceMatch = val.match(/^(\d*)d(\d+)$/i);
  if (diceMatch) {
    const count = parseInt(diceMatch[1]) || 1;
    const sides = parseInt(diceMatch[2]);
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return { delta: sign * total, note: ` (投出${sign * total >= 0 ? '+' : ''}${sign * total})` };
  }
  const delta = parseInt(val);
  if (!isNaN(delta)) {
    const result = sign * delta;
    return { delta: result, note: ` (${result >= 0 ? '+' : ''}${result})` };
  }
  return null;
}

/**
 * Parse a 【掷骰请求】 value into structured data.
 * Format: skill|expression|difficulty|description
 * Example: 侦察检定|d20+5|DC15|寻找隐藏线索
 *
 * Also handles cases where the expression has trailing Chinese text in brackets:
 *   d10+4（智力调整-6+工程学基础10） → d10+4
 */
export function parseDiceRequest(value) {
  const parts = value.split('|').map(s => s.trim());
  let expression = parts[1] || 'd20';
  // Strip everything after the first proper dice expression (Chinese/en brackets, trailing text)
  // First: remove Chinese/parenthetical annotations: d10+4（...） or d10+4(...)
  expression = expression.replace(/[（(][^)）]*[)）]/g, '');
  // Second: if there's still non-dice text after the expression, extract just the dice part
  const diceMatch = expression.match(/(\d*d\d+(?:[+-]\d+)?)/i);
  if (diceMatch) {
    expression = diceMatch[1];
  }
  return {
    skill: parts[0] || '检定',
    expression: expression || 'd20',
    difficulty: parts[2] || '',
    description: parts[3] || '',
  };
}

export function stripAICommands(text) {
  return text.replace(CMD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}
