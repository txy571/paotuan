// ==================== CoC 7e CHECK RESOLVER ====================
// Detects 【检定请求】 in AI streaming output, performs D100 rolls
// using real character data from the frontend, and returns formatted results.
// CoC 7e rules: Critical=01, Fumble=100+skill<50, no bonus/penalty on SAN.
import { state } from './state.js';

const MAX_RECURSION_DEPTH = 3;

// Regex for 【检定请求: skill=X target=N difficulty=X bonus=N penalty=N isOpposed=bool】
const CHECK_REQUEST_RE = /【检定请求[:：]\s*skill=(\S+?)\s+target=(\d+)\s+difficulty=(\S+?)\s+bonus=(-?\d+)\s+penalty=(-?\d+)\s+isOpposed=(true|false)】/;

/**
 * Detect if text contains a complete check request.
 * Returns { found, request, cleanText } where cleanText is text before the request.
 */
export function detectCheckRequest(text) {
  const match = text.match(CHECK_REQUEST_RE);
  if (!match) return { found: false, request: null, cleanText: text };

  const request = {
    skill: match[1],
    target: parseInt(match[2]),
    difficulty: match[3],       // 'regular' | 'hard' | 'extreme'
    bonus: parseInt(match[4]),
    penalty: parseInt(match[5]),
    isOpposed: match[6] === 'true',
  };
  const cleanText = text.substring(0, match.index).trim();
  return { found: true, request, cleanText };
}

/**
 * Resolve a D100 check per CoC 7e rules.
 * Returns { roll, displayRoll, targetValue, successLevel, bonusInfo, resultText }
 */
export function resolveD100Check(request) {
  const roll = Math.floor(Math.random() * 100) + 1; // 1-100

  // Determine effective target based on difficulty
  let targetValue = request.target;
  if (request.difficulty === 'hard') {
    targetValue = Math.floor(request.target / 2);
  } else if (request.difficulty === 'extreme') {
    targetValue = Math.floor(request.target / 5);
  }

  // Apply bonus/penalty dice (reroll tens die)
  let displayRoll = roll;
  let bonusInfo = '';
  const bonusDiceCount = request.bonus > 0 ? request.bonus : (request.penalty > 0 ? request.penalty : 0);
  if (bonusDiceCount > 0) {
    const tensDigit = Math.floor(roll / 10);
    const onesDigit = roll % 10;
    const altTens = [];
    for (let i = 0; i < bonusDiceCount; i++) {
      altTens.push(Math.floor(Math.random() * 10));
    }
    if (request.penalty > 0) {
      // Penalty: use the WORST tens digit (largest value → harder to succeed)
      const worstTens = Math.max(tensDigit, ...altTens);
      displayRoll = worstTens * 10 + (onesDigit === 0 ? Math.floor(Math.random() * 10) : onesDigit);
      // Ensure displayRoll is 1-100
      if (displayRoll > 100) displayRoll = 100;
      if (displayRoll === 0) displayRoll = 100;
      bonusInfo = ` 惩罚骰:${request.penalty}`;
    } else if (request.bonus > 0) {
      // Bonus: use the BEST tens digit (smallest value → easier to succeed)
      const bestTens = Math.min(tensDigit, ...altTens);
      displayRoll = bestTens * 10 + (onesDigit === 0 ? Math.floor(Math.random() * 10) : onesDigit);
      // Ensure displayRoll is 1-100
      if (displayRoll > 100) displayRoll = 100;
      if (displayRoll === 0) displayRoll = 100;
      bonusInfo = ` 奖励骰:${request.bonus}`;
    }
  }

  // Determine success level per CoC 7e rules
  let successLevel;
  if (displayRoll === 1) {
    successLevel = '大成功'; // Critical hit
  } else if (displayRoll === 100 && request.target < 50) {
    successLevel = '大失败'; // Fumble: 100 AND skill < 50
  } else if (displayRoll <= targetValue) {
    if (displayRoll <= Math.floor(request.target / 5)) {
      successLevel = '极难成功';
    } else if (displayRoll <= Math.floor(request.target / 2)) {
      successLevel = '困难成功';
    } else {
      successLevel = '普通成功';
    }
  } else {
    successLevel = '失败';
  }

  const resultText = `【检定结果: ${request.skill} D100=${displayRoll} target=${targetValue} 成功等级:${successLevel}${bonusInfo}】`;

  return {
    roll,
    displayRoll,
    targetValue,
    successLevel,
    bonusInfo,
    resultText,
  };
}

/**
 * Look up a skill's value from the character's state.
 * Returns the numeric skill value or a default.
 */
export function getSkillValue(skillId) {
  const skill = state.skills[skillId];
  if (skill && typeof skill.value === 'number') {
    return skill.value;
  }
  // Fallback: check SKILL_DEFINITIONS for base value
  const defs = state._skillDefs;
  if (defs) {
    const def = defs.find(d => d.id === skillId);
    if (def && typeof def.base === 'number') return def.base;
  }
  return 20; // sensible default
}

/**
 * Populate target values in a check request using character data.
 * AI sends skill name; frontend fills the actual numeric target.
 */
export function populateCheckTarget(request) {
  const skillId = mapSkillNameToId(request.skill);
  const value = getSkillValue(skillId);
  return { ...request, target: value, skillId };
}

// Map Chinese/English skill names back to skill IDs
function mapSkillNameToId(name) {
  const map = {
    '会计': 'accounting', '人类学': 'anthropology', '估价': 'appraise',
    '考古学': 'archaeology', '艺术与手艺': 'art_craft', '魅惑': 'charm',
    '攀爬': 'climb', '信用评级': 'credit_rating', '克苏鲁神话': 'cthulhu_mythos',
    '乔装': 'disguise', '闪避': 'dodge', '汽车驾驶': 'drive_auto',
    '电器维修': 'elec_repair', '话术': 'fast_talk', '格斗': 'fighting_brawl',
    '格斗(斗殴)': 'fighting_brawl', '斗殴': 'fighting_brawl',
    '射击(手枪)': 'firearms_handgun', '手枪': 'firearms_handgun',
    '射击(步枪)': 'firearms_rifle', '步枪': 'firearms_rifle',
    '急救': 'first_aid', '历史': 'history_coc', '恐吓': 'intimidate',
    '跳跃': 'jump', '外语': 'language_other', '母语': 'language_own',
    '法律': 'law', '图书馆使用': 'library_use', '聆听': 'listen',
    '锁匠': 'locksmith', '机械维修': 'mech_repair', '医学': 'medicine_coc',
    '博物学': 'natural_world', '导航': 'navigate', '神秘学': 'occult',
    '操作重型机械': 'op_heavy_mach', '说服': 'persuade', '驾驶': 'pilot',
    '心理学': 'psychology', '精神分析': 'psychoanalysis', '骑术': 'ride',
    '科学': 'science', '妙手': 'sleight_of_hand_coc', '侦查': 'spot_hidden',
    '潜行': 'stealth_coc', '生存': 'survival_coc', '游泳': 'swim',
    '投掷': 'throw', '追踪': 'track',
    // English fallbacks
    'spot_hidden': 'spot_hidden', 'stealth': 'stealth_coc', 'dodge': 'dodge',
    'listen': 'listen', 'fast_talk': 'fast_talk', 'persuade': 'persuade',
    'psychology': 'psychology', 'first_aid': 'first_aid',
    'fighting_brawl': 'fighting_brawl', 'firearms_handgun': 'firearms_handgun',
    'locksmith': 'locksmith', 'library_use': 'library_use',
    'occult': 'occult', 'climb': 'climb', 'swim': 'swim',
    'drive_auto': 'drive_auto', 'elec_repair': 'elec_repair',
    'mech_repair': 'mech_repair', 'navigate': 'navigate',
    'cthulhu_mythos': 'cthulhu_mythos', 'credit_rating': 'credit_rating',
    'intimidate': 'intimidate', 'charm': 'charm',
    'psychoanalysis': 'psychoanalysis', 'medicine_coc': 'medicine_coc',
    'science': 'science', 'natural_world': 'natural_world',
    'survival_coc': 'survival_coc', 'track': 'track', 'jump': 'jump',
    'ride': 'ride', 'throw': 'throw', 'law': 'law',
    'history_coc': 'history_coc', 'archaeology': 'archaeology',
    'anthropology': 'anthropology', 'accounting': 'accounting',
    'appraise': 'appraise', 'art_craft': 'art_craft',
    'disguise': 'disguise', 'op_heavy_mach': 'op_heavy_mach',
    'pilot': 'pilot', 'sleight_of_hand_coc': 'sleight_of_hand_coc',
    'language_other': 'language_other', 'language_own': 'language_own',
    '侦查': 'spot_hidden', '聆听': 'listen', '话术': 'fast_talk',
    '说服': 'persuade', '心理学': 'psychology', '急救': 'first_aid',
    '图书馆': 'library_use', '图书馆使用': 'library_use',
    '神秘学': 'occult', '攀爬': 'climb', '游泳': 'swim',
    '驾驶': 'drive_auto', '汽车驾驶': 'drive_auto',
    '电器维修': 'elec_repair', '机械维修': 'mech_repair',
    '潜行': 'stealth_coc', '生存': 'survival_coc',
    '追踪': 'track', '跳跃': 'jump', '骑术': 'ride',
    '投掷': 'throw', '法律': 'law', '历史': 'history_coc',
    '考古': 'archaeology', '考古学': 'archaeology',
    '人类学': 'anthropology', '会计': 'accounting',
    '估价': 'appraise', '艺术': 'art_craft', '手艺': 'art_craft',
    '乔装': 'disguise', '妙手': 'sleight_of_hand_coc',
    '锁匠': 'locksmith', '导航': 'navigate',
    '信用': 'credit_rating', '信用评级': 'credit_rating',
    '恐吓': 'intimidate', '魅惑': 'charm',
    '精神分析': 'psychoanalysis', '医学': 'medicine_coc',
    '科学': 'science', '博物': 'natural_world', '博物学': 'natural_world',
    '母语': 'language_own', '外语': 'language_other',
  };
  return map[name] || name;
}
