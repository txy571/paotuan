import { KP_SHARED_PREAMBLE } from './prompts/shared-preamble.js';
import { DND_SYSTEM_PROMPT } from './prompts/dnd.js';
import { COC_SYSTEM_PROMPT } from './prompts/coc.js';
import { CYBERPUNK_SYSTEM_PROMPT } from './prompts/cyberpunk.js';
import { PATHFINDER_SYSTEM_PROMPT } from './prompts/pathfinder.js';

// Re-export for backward compatibility
export { KP_SHARED_PREAMBLE };

// ==================== CONSTANTS ====================
export const ATTR_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ATTR_NAMES = {
  str: '力量 STR', dex: '敏捷 DEX', con: '体质 CON',
  int: '智力 INT', wis: '感知 WIS', cha: '魅力 CHA'
};

export const ATTR_COLORS = {
  str: '#d4443a', dex: '#4aac4a', con: '#e89030',
  int: '#4488dd', wis: '#aa88cc', cha: '#e86090'
};

// ==================== SKILL DEFINITIONS ====================
export const SKILL_DEFINITIONS = {
  dnd: [
    { id:'athletics', name:'运动', attr:'str' },
    { id:'acrobatics', name:'杂技', attr:'dex' },
    { id:'sleight_of_hand', name:'巧手', attr:'dex' },
    { id:'stealth', name:'隐匿', attr:'dex' },
    { id:'arcana', name:'奥秘', attr:'int' },
    { id:'history', name:'历史', attr:'int' },
    { id:'investigation', name:'调查', attr:'int' },
    { id:'nature', name:'自然', attr:'int' },
    { id:'religion', name:'宗教', attr:'int' },
    { id:'animal_handling', name:'驯兽', attr:'wis' },
    { id:'insight', name:'洞察', attr:'wis' },
    { id:'medicine', name:'医药', attr:'wis' },
    { id:'perception', name:'察觉', attr:'wis' },
    { id:'survival', name:'生存', attr:'wis' },
    { id:'deception', name:'欺瞒', attr:'cha' },
    { id:'intimidation', name:'威吓', attr:'cha' },
    { id:'performance', name:'表演', attr:'cha' },
    { id:'persuasion', name:'游说', attr:'cha' },
  ],
  coc: [
    { id:'accounting', name:'会计', base:5 },
    { id:'anthropology', name:'人类学', base:1 },
    { id:'appraise', name:'估价', base:5 },
    { id:'archaeology', name:'考古学', base:1 },
    { id:'art_craft', name:'艺术与手艺', base:5 },
    { id:'charm', name:'魅惑', base:15 },
    { id:'climb', name:'攀爬', base:20 },
    { id:'credit_rating', name:'信用评级', base:0 },
    { id:'cthulhu_mythos', name:'克苏鲁神话', base:0 },
    { id:'disguise', name:'乔装', base:5 },
    { id:'dodge', name:'闪避', base:'dex2' },
    { id:'drive_auto', name:'汽车驾驶', base:20 },
    { id:'elec_repair', name:'电器维修', base:10 },
    { id:'fast_talk', name:'话术', base:5 },
    { id:'fighting_brawl', name:'格斗(斗殴)', base:25 },
    { id:'firearms_handgun', name:'射击(手枪)', base:20 },
    { id:'firearms_rifle', name:'射击(步枪)', base:25 },
    { id:'first_aid', name:'急救', base:30 },
    { id:'history_coc', name:'历史', base:5 },
    { id:'intimidate', name:'恐吓', base:15 },
    { id:'jump', name:'跳跃', base:20 },
    { id:'language_other', name:'外语', base:1 },
    { id:'language_own', name:'母语', base:'edu' },
    { id:'law', name:'法律', base:5 },
    { id:'library_use', name:'图书馆使用', base:20 },
    { id:'listen', name:'聆听', base:20 },
    { id:'locksmith', name:'锁匠', base:1 },
    { id:'mech_repair', name:'机械维修', base:10 },
    { id:'medicine_coc', name:'医学', base:1 },
    { id:'natural_world', name:'博物学', base:10 },
    { id:'navigate', name:'导航', base:10 },
    { id:'occult', name:'神秘学', base:5 },
    { id:'op_heavy_mach', name:'操作重型机械', base:1 },
    { id:'persuade', name:'说服', base:10 },
    { id:'pilot', name:'驾驶', base:1 },
    { id:'psychology', name:'心理学', base:10 },
    { id:'psychoanalysis', name:'精神分析', base:1 },
    { id:'ride', name:'骑术', base:5 },
    { id:'science', name:'科学', base:1 },
    { id:'sleight_of_hand_coc', name:'妙手', base:10 },
    { id:'spot_hidden', name:'侦查', base:25 },
    { id:'stealth_coc', name:'潜行', base:20 },
    { id:'survival_coc', name:'生存', base:10 },
    { id:'swim', name:'游泳', base:20 },
    { id:'throw', name:'投掷', base:20 },
    { id:'track', name:'追踪', base:10 },
  ],
};

// ==================== SPELLS ====================
export const SPELL_SCHOOLS = ['防护', '咒法', '预言', '附魔', '塑能', '幻术', '死灵', '变化'];
export const SPELL_LEVELS = ['戏法','一环','二环','三环','四环','五环','六环','七环','八环','九环'];

// ==================== CoC ERA PRESETS ====================
export const COC_ERAS = {
  classic: {
    id: 'classic',
    name: '1920s 经典时代',
    desc: '爵士时代，一战硝烟刚散，禁酒令下的美国暗流涌动。私家侦探、记者、古物学者在迷雾笼罩的街道上追寻不可名状的真相。打字机的咔嗒声、左轮手枪的冷光、爵士乐的靡靡之音中，古老的恐怖悄然苏醒。',
    techLevel: '一战后期至二战前技术',
    backgroundOptions: ['私家侦探','记者','古物学者','医生','教授','作家','退役军人','图书管理员','古董商','警探'],
    skillDefaults: { 'drive_auto':20, 'library_use':20, 'occult':5, 'fast_talk':5, 'firearms_handgun':20 },
  },
  victorian: {
    id: 'victorian',
    name: '1890s 维多利亚时代',
    desc: '煤气灯下的伦敦，工业革命的烟尘中隐藏着远古的秘密。绅士俱乐部的成员、灵媒、探险家在大英帝国的阴影下调查超自然事件。马车碾过鹅卵石路面的回响中，煤气灯的光芒在雾中摇曳，照亮了不该被照亮的东西。',
    techLevel: '维多利亚时代技术（蒸汽动力、煤气灯、马车、电报）',
    backgroundOptions: ['绅士学者','灵媒','探险家','警探','医生','牧师','记者','古董收藏家','殖民官员','私家教师'],
    skillDefaults: { 'library_use':25, 'occult':10, 'ride':25, 'language_other':10, 'history_coc':10 },
  },
  modern: {
    id: 'modern',
    name: '现代',
    desc: '信息时代的光鲜表面下，宇宙的恐怖并未消散。黑客、调查记者、法医科学家在数据洪流中追踪异常信号。智能手机的蓝光、监控摄像头的红点、社交媒体的信息流——这些现代工具既是武器也是牢笼，而古老的黑暗正在学会使用它们。',
    techLevel: '当代技术（互联网、智能手机、电脑、现代武器、法医学）',
    backgroundOptions: ['黑客','调查记者','法医','大学教授','私家侦探','图书管理员','联邦探员','纪录片导演','程序员','心理医生'],
    skillDefaults: { 'drive_auto':30, 'elec_repair':10, 'library_use':20, 'spot_hidden':30 },
  },
};

// ==================== THEME NAMES ====================
export const THEME_NAMES = {
  dnd: 'D&D 5e', coc: '克苏鲁的呼唤',
  cyberpunk: '赛博朋克 RED', pathfinder: '开拓者'
};

export const ATTR_BASE  = 20;
export const ATTR_MAX   = 100;
export const ATTR_POOL  = 240;

export const SKILL_MAX     = 99;   // 百分制技能单个上限
export const SKILL_TOTAL   = 400;  // 百分制技能总值软上限
export const MAX_TRAITS    = 6;    // 特质数量上限
export const MAX_FEATS     = 6;    // 专长数量上限

// ==================== STATE ====================
export const state = {
  theme: 'dnd',
  currentDice: 20,
  attributes: { str:20, dex:20, con:20, int:20, wis:20, cha:20 },
  skills: {},      // { skillId: { value: number, proficient: boolean } }
  spells: [],      // [{ id, name, level, school, castingTime, range, components, duration, description, prepared, source }]
  traits: [],
  feats: [],
  equipment: [],   // [{ name, qty, weight, desc, equipped, category }]
  portraitData: null,
  rollHistory: [],
  currentCharId: null,
  initiative: [],
  initNextId: 1,
  era: 'classic',  // CoC era preset
};

export const kpState = {
  active: false,
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-6',
  chatHistory: [],
  apiHistory: [],
  streaming: false,
  streamingAbort: null,
  _compressing: false,
  // Pending dice request from AI: { skill, expression, difficulty, description, resolve }
  pendingDiceRequest: null,
};

export let scenarioDbContent = '';
export function setScenarioDbContent(v) { scenarioDbContent = v; }

// ── Scenario Metadata (act tracking + task management) ──
export const scenarioMeta = {
  synopsis: '',       // 剧本梗概（一段话概括整体故事）
  background: '',
  era: '',
  playerCount: '',
  actCount: 0,
  estimatedDuration: '',
  currentAct: 0,
  currentActName: '',
  acts: [],        // [{ name, status: 'pending'|'started'|'completed' }]
  tasks: [],       // [{ id, description, status: 'active'|'completed', addedAt }]
  outline: '',
  lastUpdated: null,
};

export function initScenarioMeta() {
  scenarioMeta.synopsis = '';
  scenarioMeta.background = '';
  scenarioMeta.era = '';
  scenarioMeta.playerCount = '';
  scenarioMeta.actCount = 0;
  scenarioMeta.estimatedDuration = '';
  scenarioMeta.currentAct = 0;
  scenarioMeta.currentActName = '';
  scenarioMeta.acts = [];
  scenarioMeta.tasks = [];
  scenarioMeta.outline = '';
  scenarioMeta.lastUpdated = null;
}

// ── Structured Scenario Library ──
export const scenarioLibrary = [];
export let activeScenario = null;
export function setActiveScenario(v) { activeScenario = v; }

// SAN/HP now live on character card, not here. cocState keeps session-level mechanics only.
export const cocState = {
  luck: 50,
  mp: 10,
  maxMp: 10,
  cthulhuMythos: 0,
  chronicle: [],
  skillChecks: [],
  _dailySanLoss: 0, // tracked per in-game day for indefinite insanity
};

export function initCocState() {
  const pow = state.attributes.wis || 50;
  cocState.luck      = Math.floor(Math.random() * 30) + 40;
  cocState.mp        = Math.floor(pow / 10);
  cocState.maxMp     = cocState.mp;
  cocState.cthulhuMythos = 0;
  cocState.chronicle     = [];
  cocState.skillChecks   = [];
}

// Helper: get character SAN/HP from DOM (moved to character card)
export function getCharSan() {
  return parseInt(document.getElementById('charSan')?.value) || 100;
}
export function getCharHp() {
  return parseInt(document.getElementById('charHP')?.value) || 100;
}
export function getCharMaxSan() {
  return parseInt(document.getElementById('charMaxSan')?.value) || 100;
}
export function getCharMaxHp() {
  return parseInt(document.getElementById('charMaxHP')?.value) || 100;
}
export function setCharSan(v) {
  const el = document.getElementById('charSan'); if (el) el.value = Math.max(0, Math.min(getCharMaxSan(), v));
}
export function setCharHp(v) {
  const el = document.getElementById('charHP'); if (el) el.value = Math.max(-5, Math.min(getCharMaxHp(), v));
}

// ==================== AI KP SYSTEM-SPECIFIC PROMPTS ====================
// Prompts are now in separate files under prompts/ for maintainability.
// They extend KP_SHARED_PREAMBLE with rules specific to each RPG system.
export const KP_SYSTEM_PROMPTS = {
  dnd: DND_SYSTEM_PROMPT,
  coc: COC_SYSTEM_PROMPT,
  cyberpunk: CYBERPUNK_SYSTEM_PROMPT,
  pathfinder: PATHFINDER_SYSTEM_PROMPT,
};

export const KP_QUICK_ACTIONS = {
  dnd:       ['开始冒险', '观察周围', '与NPC交谈', '搜索陷阱', '进行攻击', '施展法术', '使用物品'],
  coc:       ['开始调查', '侦查四周', '询问证人', '翻阅古籍', '潜行尾随', '孤注一掷!', '逃跑!!!'],
  cyberpunk: ['接取任务', '黑入系统', '街头打听', '使用义体', '火力压制', '驾车追逐', '交易情报'],
  pathfinder:['开始探索', '战术侦察', '知识检定', '交涉说服', '发动攻击', '施展神术', '治疗伤员']
};
