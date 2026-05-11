// ==================== CoC 7e SAN MECHANICS ====================
// Implements CoC 7e sanity rules: SAN loss formulas, insanity thresholds,
// max SAN calculation (99 - Cthulhu Mythos), daily SAN loss tracking.
import { getCharSan, setCharSan, getCharMaxSan, cocState } from './state.js';

// SAN loss by horror type: { success: formula, failure: formula }
// "0" means no loss. Formulas use dice notation like "1d3", "1d4+1", etc.
const SAN_LOSS_TABLE = {
  corpse_human:      { success: '0', failure: '1d3' },
  unnatural_death:   { success: '0', failure: '1d4+1' },
  monster_encounter: { success: '0', failure: '1d6' },
  mythos_encounter:  { success: '1d3', failure: '1d20' },
  mythos_tome:       { success: '1d4', failure: '2d8' },
};

/** Calculate max SAN: 99 - Cthulhu Mythos */
export function getMaxSan() {
  return Math.max(0, 99 - cocState.cthulhuMythos);
}

/** Roll dice notation like "1d3", "1d4+1", "2d8". Returns the rolled number. */
function rollFormula(notation) {
  if (notation === '0' || !notation) return 0;
  const m = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!m) return 0;
  const count = parseInt(m[1]) || 1;
  const sides = parseInt(m[2]);
  const mod = parseInt(m[3]) || 0;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total + mod;
}

/**
 * Process a SAN check result.
 * @param horrorType - key from SAN_LOSS_TABLE or custom
 * @param success - whether the SAN check succeeded
 * @returns {{ loss, newSan, maxSan, temporaryInsanity, indefiniteInsanity, permanentInsanity }}
 */
export function processSanCheck(horrorType, success) {
  const entry = SAN_LOSS_TABLE[horrorType];
  if (!entry) return { loss: 0, newSan: getCharSan(), maxSan: getMaxSan(), temporaryInsanity: false, indefiniteInsanity: false, permanentInsanity: false };

  const lossKey = success ? 'success' : 'failure';
  const loss = rollFormula(entry[lossKey]);

  if (loss === 0) return { loss: 0, newSan: getCharSan(), maxSan: getMaxSan(), temporaryInsanity: false, indefiniteInsanity: false, permanentInsanity: false };

  const currentSan = getCharSan();
  const newSan = Math.max(0, currentSan - loss);
  setCharSan(newSan);

  // Temporary insanity: single loss >= 5 OR loss >= 1/5 current SAN in one check
  const temporaryInsanity = loss >= 5 || loss >= Math.floor(currentSan / 5);

  // Track daily SAN loss for indefinite insanity
  cocState._dailySanLoss = (cocState._dailySanLoss || 0) + loss;
  const indefiniteInsanity = cocState._dailySanLoss >= Math.floor(getMaxSan() / 5);

  // Permanent insanity: SAN <= 0
  const permanentInsanity = newSan <= 0;

  return { loss, newSan, maxSan: getMaxSan(), temporaryInsanity, indefiniteInsanity, permanentInsanity };
}

/** Reset daily SAN loss tracker (call when in-game day passes) */
export function resetDailySanLoss() {
  cocState._dailySanLoss = 0;
}

/** Get current daily SAN loss total */
export function getDailySanLoss() {
  return cocState._dailySanLoss || 0;
}

/**
 * Get insanity description suggestions for the AI to narrate.
 * Returns descriptive text based on SAN loss severity.
 */
export function getInsanityDescription(temporaryInsanity, indefiniteInsanity, permanentInsanity, loss) {
  if (permanentInsanity) return '永久性疯狂：角色SAN降至0，已完全陷入疯狂，成为NPC。';
  if (indefiniteInsanity) return `不定性疯狂：单日SAN累计损失已达阈值。角色将经历持续1d10个月的深层精神创伤。`;
  if (temporaryInsanity) {
    if (loss >= 5) return `临时性疯狂：单次SAN损失≥5点。角色经历持续1d10小时的急性精神崩溃。`;
    return `临时性疯狂：单次SAN损失≥当前SAN的1/5。角色经历持续1d10小时的急性精神崩溃。`;
  }
  return '';
}

/** Re-export SAN_LOSS_TABLE keys for type reference */
export const HORROR_TYPES = Object.keys(SAN_LOSS_TABLE);
