// ==================== AI COMMAND PARSER ====================
import { state, cocState, setCharSan, setCharHp, getCharSan, getCharHp, getCharMaxHp } from './state.js';
import { renderTraits, renderFeats, renderEquipment } from './character.js';
import { renderCocChronicle, renderCocStatus } from './coc-status.js';
import { applyMemoryCommand } from './memory-bank.js';

// All known command types (memory types added at end)
const CMD_TYPES = 'SAN|HP|LUCK|TRAIT|REMOVE_TRAIT|CHRONICLE|SKILL_CHECK|ITEM|REMOVE_ITEM|NPC|CLUE|PLOT|MEMORY|检定请求|检定结果|掷骰请求|INITIATIVE|END_COMBAT|CHASE|END_CHASE';
const CMD_RE = new RegExp(`【(${CMD_TYPES})[：:](.+?)】`);

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
          if (cmd.value.toLowerCase().startsWith('d')) {
            const diceMatch = cmd.value.match(/^(\d*)d(\d+)$/i);
            if (diceMatch) {
              const count = parseInt(diceMatch[1]) || 1;
              const sides = parseInt(diceMatch[2]);
              let total = 0;
              for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
              setCharSan(oldVal - total);
              changes.push(`SAN: ${oldVal} → ${getCharSan()} (投出${total})`);
            }
          } else {
            const delta = parseInt(cmd.value);
            if (!isNaN(delta)) {
              setCharSan(oldVal + delta);
              changes.push(`SAN: ${oldVal} → ${getCharSan()} (${delta >= 0 ? '+' : ''}${delta})`);
            }
          }
          break;
        }
        case 'HP': {
          const oldVal = getCharHp();
          const delta = parseInt(cmd.value);
          if (!isNaN(delta)) {
            setCharHp(oldVal + delta);
            changes.push(`HP: ${oldVal} → ${getCharHp()} (${delta >= 0 ? '+' : ''}${delta})`);
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
 * Parse a 【掷骰请求】 value into structured data.
 * Format: skill|expression|difficulty|description
 * Example: 侦察检定|d20+5|DC15|寻找隐藏线索
 */
export function parseDiceRequest(value) {
  const parts = value.split('|').map(s => s.trim());
  return {
    skill: parts[0] || '检定',
    expression: parts[1] || 'd20',
    difficulty: parts[2] || '',
    description: parts[3] || '',
  };
}

export function stripAICommands(text) {
  return text.replace(CMD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}
