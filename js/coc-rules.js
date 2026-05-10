// ==================== CoC 7e SPECIAL RULES ====================
// Luck spending, pushing the roll, skill improvement.
import { cocState, state } from './state.js';
import { showToast } from './utils.js';

/**
 * Spend luck to adjust a D100 roll (point-for-point).
 * Cannot be used on SAN checks.
 * @returns {{ success: boolean, reason?: string, adjustedRoll?: number, luckRemaining?: number }}
 */
export function spendLuck(amount, originalRoll) {
  if (!amount || amount <= 0) return { success: false, reason: '无效的幸运消耗量' };
  if (cocState.luck < amount) return { success: false, reason: `幸运值不足（当前${cocState.luck}，需要${amount}）` };

  cocState.luck -= amount;
  const adjustedRoll = Math.max(1, originalRoll - amount);

  return {
    success: true,
    adjustedRoll,
    luckRemaining: cocState.luck,
  };
}

/**
 * Can luck be spent? (Must have luck > 0 and not be a SAN check)
 */
export function canSpendLuck(isSanCheck) {
  if (isSanCheck) return false;
  return cocState.luck > 0;
}

/**
 * Mark a skill for improvement at end of scenario.
 * Only marks skills that were used successfully during play.
 */
export function markSkillForImprovement(skillId) {
  if (!skillId || cocState.skillChecks.includes(skillId)) return;
  cocState.skillChecks.push(skillId);
}

/**
 * Roll for skill improvement at end of scenario.
 * CoC 7e: roll D100 > current skill value → improve by 1d10.
 * @returns {{ improved: boolean, roll?: number, improvement?: number, newValue?: number }}
 */
export function rollSkillImprovement(skillId) {
  const currentValue = state.skills[skillId]?.value;
  if (typeof currentValue !== 'number' || currentValue <= 0) {
    return { improved: false, reason: '技能未设置有效值' };
  }

  const roll = Math.floor(Math.random() * 100) + 1;
  if (roll > currentValue) {
    const improvement = Math.floor(Math.random() * 10) + 1;
    const newValue = Math.min(99, currentValue + improvement);
    state.skills[skillId].value = newValue;
    return { improved: true, roll, improvement, newValue };
  }
  return { improved: false, roll };
}

/**
 * Process all marked skill improvements at end of scenario.
 * @returns Array of improvement results.
 */
export function processAllSkillImprovements() {
  const results = [];
  for (const skillId of [...cocState.skillChecks]) {
    const result = rollSkillImprovement(skillId);
    if (result.improved) {
      results.push({ skillId, ...result });
    }
  }
  cocState.skillChecks = [];
  return results;
}

/**
 * Push the roll: player declares extra effort after failure.
 * The frontend sends this context back to AI with push=true.
 * AI re-checks with same difficulty but worse consequences on failure.
 */
export function formatPushRequest(skillName, targetValue, difficulty) {
  return `\n【孤注一掷: ${skillName} target=${targetValue} difficulty=${difficulty}】\n`;
}

/**
 * Get difficulty value for a given base value and difficulty level.
 */
export function getDifficultyTarget(baseValue, difficulty) {
  if (difficulty === 'hard') return Math.floor(baseValue / 2);
  if (difficulty === 'extreme') return Math.floor(baseValue / 5);
  return baseValue; // regular
}

/**
 * Roll a D100 check and determine success level.
 * Used for quick manual resolution (non-AI).
 */
export function quickD100Check(targetValue) {
  const roll = Math.floor(Math.random() * 100) + 1;

  if (roll === 1) return { roll, successLevel: '大成功' };
  if (roll === 100) {
    return { roll, successLevel: targetValue < 50 ? '大失败' : '失败' };
  }
  if (roll <= targetValue) {
    if (roll <= Math.floor(targetValue / 5)) return { roll, successLevel: '极难成功' };
    if (roll <= Math.floor(targetValue / 2)) return { roll, successLevel: '困难成功' };
    return { roll, successLevel: '普通成功' };
  }
  return { roll, successLevel: '失败' };
}
