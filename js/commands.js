// ==================== AI COMMAND PARSER ====================
import { state, cocState } from './state.js';
import { renderTraits, renderFeats, renderEquipment } from './character.js';
import { renderCocChronicle, renderCocStatus } from './coc-status.js';

export function parseAICommands(text) {
  const commands = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/【(SAN|HP|LUCK|TRAIT|REMOVE_TRAIT|CHRONICLE|SKILL_CHECK|ITEM|REMOVE_ITEM)[：:](.+?)】/);
    if (match) {
      commands.push({ type: match[1], value: match[2].trim(), raw: line });
    }
  }
  return commands;
}

export function applyAICommands(commands) {
  const changes = [];
  for (const cmd of commands) {
    try {
      switch (cmd.type) {
        case 'SAN': {
          const oldVal = cocState.san;
          if (cmd.value.toLowerCase().startsWith('d')) {
            const diceMatch = cmd.value.match(/^(\d*)d(\d+)$/i);
            if (diceMatch) {
              const count = parseInt(diceMatch[1]) || 1;
              const sides = parseInt(diceMatch[2]);
              let total = 0;
              for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
              cocState.san = Math.max(0, cocState.san - total);
              changes.push(`SAN: ${oldVal} → ${cocState.san} (投出${total})`);
            }
          } else {
            const delta = parseInt(cmd.value);
            if (!isNaN(delta)) {
              cocState.san = Math.max(0, Math.min(cocState.maxSan, cocState.san + delta));
              changes.push(`SAN: ${oldVal} → ${cocState.san} (${delta >= 0 ? '+' : ''}${delta})`);
            }
          }
          break;
        }
        case 'HP': {
          const oldVal = cocState.currentHp;
          const delta = parseInt(cmd.value);
          if (!isNaN(delta)) {
            cocState.currentHp = Math.max(-5, Math.min(cocState.maxHp, cocState.currentHp + delta));
            changes.push(`HP: ${oldVal} → ${cocState.currentHp} (${delta >= 0 ? '+' : ''}${delta})`);
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
            state.equipment.push({ name, qty: 1 });
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
      }
    } catch(e) {
      console.warn('AI command parse error:', cmd, e);
    }
  }
  return changes;
}

export function stripAICommands(text) {
  return text.replace(/【(SAN|HP|LUCK|TRAIT|REMOVE_TRAIT|CHRONICLE|SKILL_CHECK|ITEM|REMOVE_ITEM)[：:].+?】\n?/g, '');
}
