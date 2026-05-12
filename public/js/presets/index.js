import { DND_TRAITS, DND_FEATS } from './dnd.js';
import { COC_TRAITS, COC_FEATS } from './coc.js';
import { CYBERPUNK_TRAITS, CYBERPUNK_FEATS } from './cyberpunk.js';
import { PATHFINDER_TRAITS, PATHFINDER_FEATS } from './pathfinder.js';

export const PRESET_TRAITS = {
  dnd: DND_TRAITS,
  coc: COC_TRAITS,
  cyberpunk: CYBERPUNK_TRAITS,
  pathfinder: PATHFINDER_TRAITS,
};

export const PRESET_FEATS = {
  dnd: DND_FEATS,
  coc: COC_FEATS,
  cyberpunk: CYBERPUNK_FEATS,
  pathfinder: PATHFINDER_FEATS,
};

// ── Custom presets (localStorage) ──────────────────────
const CUSTOM_TRAITS_KEY = 'ttrpg-custom-traits';
const CUSTOM_FEATS_KEY  = 'ttrpg-custom-feats';

function _loadCustom(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function _saveCustom(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function getAllTraits(theme) {
  const builtin = PRESET_TRAITS[theme] || [];
  const custom = _loadCustom(CUSTOM_TRAITS_KEY)[theme] || [];
  return [...builtin, ...custom];
}

export function getAllFeats(theme) {
  const builtin = PRESET_FEATS[theme] || [];
  const custom = _loadCustom(CUSTOM_FEATS_KEY)[theme] || [];
  return [...builtin, ...custom];
}

export function saveCustomTrait(theme, name, desc) {
  const all = _loadCustom(CUSTOM_TRAITS_KEY);
  if (!all[theme]) all[theme] = [];
  if (!all[theme].some(t => t.name === name)) {
    all[theme].push({ name, desc });
    _saveCustom(CUSTOM_TRAITS_KEY, all);
  }
}

export function saveCustomFeat(theme, name, desc) {
  const all = _loadCustom(CUSTOM_FEATS_KEY);
  if (!all[theme]) all[theme] = [];
  if (!all[theme].some(f => f.name === name)) {
    all[theme].push({ name, desc });
    _saveCustom(CUSTOM_FEATS_KEY, all);
  }
}
