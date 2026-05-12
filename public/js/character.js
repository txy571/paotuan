// ==================== CHARACTER SHEET ====================
import { state, ATTR_KEYS, ATTR_NAMES, ATTR_COLORS, ATTR_BASE, ATTR_MAX, ATTR_POOL, SKILL_MAX, SKILL_TOTAL, MAX_TRAITS, MAX_FEATS, SKILL_DEFINITIONS, COC_ERAS, SPELL_SCHOOLS, SPELL_LEVELS, kpState } from './state.js';
import { esc, showToast, modPct, modPctNum } from './utils.js';
import { dom } from './dom.js';
import { PRESET_TRAITS, PRESET_FEATS, getAllTraits, getAllFeats, saveCustomTrait, saveCustomFeat } from './presets/index.js';

// ── Proficiency ──────────────────────────────────
function getProfBonus(level) {
  return 2 + Math.floor(((level || 1) - 1) / 4);
}

// ── Portrait ─────────────────────────────────────
function handlePortraitFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    compressPortrait(ev.target.result, (compressed) => {
      state.portraitData = compressed;
      if (dom.portraitImg) {
        dom.portraitImg.src = compressed;
        dom.portraitImg.style.display = 'block';
      }
      if (dom.portraitPlaceholder) dom.portraitPlaceholder.style.display = 'none';
    });
  };
  reader.readAsDataURL(file);
}

function compressPortrait(dataUrl, callback) {
  const img = new Image();
  img.onload = function() {
    const MAX_W = 400;
    const MAX_H = 533;
    let w = img.width;
    let h = img.height;
    // Scale down to fit within MAX_W × MAX_H, maintaining aspect ratio
    if (w > MAX_W || h > MAX_H) {
      const ratio = Math.min(MAX_W / w, MAX_H / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Try qualities from high to low until size < 100KB
    const qualities = [0.7, 0.55, 0.4, 0.3];
    let best = null;
    for (const q of qualities) {
      const result = canvas.toDataURL('image/jpeg', q);
      best = result;
      // Estimate base64 size: ~4/3 of binary size
      const estimatedBytes = (result.length - result.indexOf(',') - 1) * 0.75;
      if (estimatedBytes < 100 * 1024) break;
    }
    callback(best);
  };
  img.src = dataUrl;
}

export function setupPortrait() {
  const zone = dom.portraitZone;
  if (!zone) return;
  zone.addEventListener('click', () => document.getElementById('portraitInput')?.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handlePortraitFile(e.dataTransfer.files[0]);
  });
  const input = document.getElementById('portraitInput');
  if (input) input.addEventListener('change', e => handlePortraitFile(e.target.files[0]));
}

// ── Attributes ───────────────────────────────────
function ptsUsed() {
  let used = 0;
  for (const k of ATTR_KEYS) { used += state.attributes[k] - ATTR_BASE; }
  return used;
}

function ptsRemaining() {
  return ATTR_POOL - ptsUsed();
}

export function renderAttributes() {
  const grid = dom.attrGrid;
  if (!grid) return;
  const remaining = ptsRemaining();
  let html = '';

  for (const k of ATTR_KEYS) {
    const v = state.attributes[k];
    const mod = modPct(v);
    const pct = v;
    const color = ATTR_COLORS[k];
    html += `
      <div class="attr-bar-row">
        <div class="attr-bar-name">${ATTR_NAMES[k]}</div>
        <div class="attr-bar-track">
          <div class="attr-bar-fill" style="width:${pct}%;background:${v < 30 ? '#555' : color};"></div>
        </div>
        <div class="attr-bar-val" style="color:${v >= 90 ? '#ffcc00' : 'var(--text)'}">${v}</div>
        <div class="attr-bar-mod" style="color:${parseInt(mod) > 5 ? '#ffcc00' : 'var(--text-dim)'}">${mod}</div>
        <div class="attr-bar-btns">
          <button class="attr-bar-btn" data-action="character:adjustAttr" data-attr="${k}" data-delta="-5" ${v - 5 < ATTR_BASE ? 'disabled style="opacity:.25"' : ''}>−5</button>
          <button class="attr-bar-btn" data-action="character:adjustAttr" data-attr="${k}" data-delta="-1" ${v - 1 < ATTR_BASE ? 'disabled style="opacity:.25"' : ''}>−</button>
          <button class="attr-bar-btn" data-action="character:adjustAttr" data-attr="${k}" data-delta="+1" ${remaining < 1 || v + 1 > ATTR_MAX ? 'disabled style="opacity:.25"' : ''}>+</button>
          <button class="attr-bar-btn" data-action="character:adjustAttr" data-attr="${k}" data-delta="+5" ${remaining < 5 || v + 5 > ATTR_MAX ? 'disabled style="opacity:.25"' : ''}>+5</button>
        </div>
      </div>`;
  }

  grid.innerHTML = html;

  if (dom.ptsRemaining) {
    dom.ptsRemaining.textContent = `可分配点数: ${remaining} / ${ATTR_POOL}`;
    dom.ptsRemaining.style.color = remaining < 20 ? 'var(--accent2)' : 'var(--text-gold)';
  }
}

export function adjustAttr(attr, delta) {
  const newVal = state.attributes[attr] + delta;
  if (newVal < ATTR_BASE || newVal > ATTR_MAX) return;
  const newUsed = ptsUsed() - (state.attributes[attr] - ATTR_BASE) + (newVal - ATTR_BASE);
  if (newUsed > ATTR_POOL) return;
  state.attributes[attr] = newVal;
  renderAttributes();
  renderSkills();
}

// ── Skills (Numeric) ─────────────────────────────
export function renderSkills() {
  const list = dom.skillsList;
  if (!list) return;
  const theme = state.theme;
  const skillDefs = SKILL_DEFINITIONS[theme] || [];

  if (theme === 'coc') {
    list.innerHTML = skillDefs.map(s => {
      const current = state.skills[s.id]?.value ?? s.base ?? 0;
      return `<div class="skill-row-coc">
        <span class="skill-name-coc">${s.name}</span>
        <span class="skill-base-coc">(基础 ${typeof s.base === 'number' ? s.base + '%' : '—'})</span>
        <input type="number" class="skill-val-input" value="${current}" min="0" max="${SKILL_MAX}"
          onchange="document.dispatchEvent(new CustomEvent('skill-update',{detail:{id:'${s.id}',value:Math.max(0,Math.min(${SKILL_MAX},parseInt(this.value)||0))}}))"
          title="单个技能上限 ${SKILL_MAX}%">
        <span class="skill-pct">${current}%</span>
      </div>`;
    }).join('');
  } else {
    const level = parseInt(document.getElementById('charLevel')?.value) || 1;
    const profBonus = getProfBonus(level);
    list.innerHTML = skillDefs.map(s => {
      const attrVal = state.attributes[s.attr] || ATTR_BASE;
      const attrMod = modPctNum(attrVal);
      const proficient = state.skills[s.id]?.proficient || false;
      const total = attrMod + (proficient ? profBonus : 0);
      const totalStr = total >= 0 ? `+${total}` : `${total}`;
      return `<div class="skill-chip ${proficient ? 'proficient' : ''}" data-action="character:toggleSkill" data-skill="${s.id}">
        <span class="skill-dot ${proficient ? 'on' : 'off'}"></span>
        <span class="skill-name">${s.name} <small style="color:var(--text-dim)">(${s.attr.toUpperCase()})</small></span>
        <span class="skill-bonus">${totalStr}</span>
      </div>`;
    }).join('');
  }
}

export function setSkillValue(id, value) {
  if (!state.skills[id]) state.skills[id] = { value: 0, proficient: false };
  state.skills[id].value = Math.min(value, SKILL_MAX);
  // Soft warning on total
  const total = totalSkillPoints();
  if (total > SKILL_TOTAL) {
    showToast(`技能总点数 (${total}) 超过建议上限 ${SKILL_TOTAL}`, 'warn');
  }
}

export function totalSkillPoints() {
  return Object.values(state.skills).reduce((sum, s) => sum + (typeof s.value === 'number' ? s.value : 0), 0);
}

export function toggleSkill(id) {
  if (!state.skills[id]) state.skills[id] = { value: 0, proficient: false };
  state.skills[id].proficient = !state.skills[id].proficient;
  renderSkills();
}

// ── Spells ───────────────────────────────────────
export function renderSpells() {
  const list = dom.spellsList;
  if (!list) return;
  if (!state.spells.length) {
    list.innerHTML = '<div class="empty-state">暂无法术，点击下方按钮添加</div>';
    return;
  }
  const grouped = {};
  for (const sp of state.spells) {
    const lv = sp.level || 0;
    if (!grouped[lv]) grouped[lv] = [];
    grouped[lv].push(sp);
  }
  const levelNames = ['戏法','一环','二环','三环','四环','五环','六环','七环','八环','九环'];
  let html = '';
  for (let lv = 0; lv <= 9; lv++) {
    if (!grouped[lv] || !grouped[lv].length) continue;
    html += `<div class="spell-level-head">${levelNames[lv] || lv + '环'} (${grouped[lv].length})</div>`;
    for (let i = 0; i < grouped[lv].length; i++) {
      const sp = grouped[lv][i];
      const realIdx = state.spells.indexOf(sp);
      html += `<div class="spell-card ${sp.prepared ? 'prepared' : ''}">
        <div class="spell-card-header">
          <span class="spell-card-name">${esc(sp.name) || '未命名法术'}</span>
          <span class="spell-card-school">${esc(sp.school) || '—'}</span>
          <span class="spell-card-prep" data-action="character:toggleSpellPrepared" data-spell="${realIdx}" title="${sp.prepared ? '已准备' : '未准备'}">${sp.prepared ? '◆' : '◇'}</span>
          <span class="trait-remove" onclick="document.dispatchEvent(new CustomEvent('spell-remove',{detail:${realIdx}}))">×</span>
        </div>
        <div class="spell-card-body">
          <div class="spell-card-meta">
            ${sp.castingTime ? '<span>施法: ' + esc(sp.castingTime) + '</span>' : ''}
            ${sp.range ? '<span>射程: ' + esc(sp.range) + '</span>' : ''}
            ${sp.components ? '<span>成分: ' + esc(sp.components) + '</span>' : ''}
            ${sp.duration ? '<span>持续: ' + esc(sp.duration) + '</span>' : ''}
          </div>
          ${sp.description ? '<div class="spell-card-desc">' + esc(sp.description) + '</div>' : ''}
          <button class="btn btn-ghost btn-xs" style="margin-top:4px;" data-action="character:editSpell" data-spell="${realIdx}">编辑</button>
        </div>
      </div>`;
    }
  }
  list.innerHTML = html;
}

export function addSpell() {
  state.spells.push({
    id: 'spell_' + Date.now(),
    name: '', level: 0, school: '', castingTime: '',
    range: '', components: '', duration: '', description: '',
    prepared: false, source: ''
  });
  renderSpells();
  // Scroll to the new spell
  const list = dom.spellsList;
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function editSpell(idx) {
  const sp = state.spells[idx];
  if (!sp) return;
  const name = prompt('法术名称', sp.name);
  if (name === null) return;
  sp.name = name;
  const level = prompt('法术环位 (0-9)', sp.level?.toString() || '0');
  if (level !== null) sp.level = parseInt(level) || 0;
  const school = prompt('学派', sp.school);
  if (school !== null) sp.school = school;
  const castingTime = prompt('施法时间', sp.castingTime);
  if (castingTime !== null) sp.castingTime = castingTime;
  const range = prompt('射程', sp.range);
  if (range !== null) sp.range = range;
  const components = prompt('成分 (V/S/M)', sp.components);
  if (components !== null) sp.components = components;
  const duration = prompt('持续时间', sp.duration);
  if (duration !== null) sp.duration = duration;
  const description = prompt('描述', sp.description);
  if (description !== null) sp.description = description;
  renderSpells();
}

export function toggleSpellPrepared(idx) {
  const sp = state.spells[idx];
  if (sp) { sp.prepared = !sp.prepared; renderSpells(); }
}

export function removeSpell(idx) {
  state.spells.splice(idx, 1);
  renderSpells();
}

// ── Traits & Feats ───────────────────────────────
export function renderTraits() {
  if (!dom.traitList) return;
  const count = state.traits.length;
  const remaining = MAX_TRAITS - count;
  const presets = getAllTraits(state.theme);
  // Filter out presets already in the list
  const names = new Set(state.traits.map(t => t.name));
  const available = presets.filter(p => !names.has(p.name));
  const presetHTML = available.length && remaining
    ? `<div class="preset-tags"><span style="font-size:.68rem;color:var(--text-dim);">快速添加:</span>${available.map(p =>
        `<span class="preset-tag" onclick="document.dispatchEvent(new CustomEvent('preset-trait-add',{detail:{name:'${esc(p.name).replace(/'/g, "\\'")}',desc:'${esc(p.desc).replace(/'/g, "\\'")}'}}))">${esc(p.name)}</span>`
      ).join('')}</div>`
    : '';
  dom.traitList.innerHTML = (count === 0
    ? `<div class="empty-state">暂无特质，点击下方按钮添加 (最多 ${MAX_TRAITS} 个)</div>`
    : state.traits.map((t, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(t.name)}" placeholder="名称" onchange="document.dispatchEvent(new CustomEvent('trait-update',{detail:{i:${i},k:'name',v:this.value}}))">
        <input class="inline-input wide" value="${esc(t.desc)}" placeholder="描述" onchange="document.dispatchEvent(new CustomEvent('trait-update',{detail:{i:${i},k:'desc',v:this.value}}))">
        ${t.name ? `<span class="preset-save" title="保存为自定义预设" onclick="document.dispatchEvent(new CustomEvent('preset-trait-save',{detail:{i:${i}}}))">⬇</span>` : ''}
        <span class="trait-remove" onclick="document.dispatchEvent(new CustomEvent('trait-remove',{detail:${i}}))">×</span>
      </div>`).join(''))
    + `<div style="font-size:.7rem;color:var(--text-dim);margin-top:4px;">${count}/${MAX_TRAITS} ${remaining ? '还可添加 ' + remaining + ' 个' : '已达上限'}</div>`
    + presetHTML;
}

export function addPresetTrait(name, desc) {
  if (state.traits.length >= MAX_TRAITS) {
    showToast(`特质数量已达上限 (${MAX_TRAITS} 个)`, 'warn');
    return;
  }
  // Check for duplicate
  if (state.traits.some(t => t.name === name)) {
    showToast(`特质 "${name}" 已存在`, 'warn');
    return;
  }
  state.traits.push({ name, desc });
  renderTraits();
}

export function addPresetFeat(name, desc) {
  if (state.feats.length >= MAX_FEATS) {
    showToast(`专长数量已达上限 (${MAX_FEATS} 个)`, 'warn');
    return;
  }
  if (state.feats.some(f => f.name === name)) {
    showToast(`专长 "${name}" 已存在`, 'warn');
    return;
  }
  state.feats.push({ name, desc });
  renderFeats();
}

export function saveTraitPreset(i) {
  const t = state.traits[i];
  if (!t || !t.name.trim()) return;
  saveCustomTrait(state.theme, t.name.trim(), t.desc.trim());
  showToast(`特质"${t.name}"已保存为预设`);
  renderTraits();
}
export function saveFeatPreset(i) {
  const f = state.feats[i];
  if (!f || !f.name.trim()) return;
  saveCustomFeat(state.theme, f.name.trim(), f.desc.trim());
  showToast(`专长"${f.name}"已保存为预设`);
  renderFeats();
}

export function addTrait() {
  if (state.traits.length >= MAX_TRAITS) {
    showToast(`特质数量已达上限 (${MAX_TRAITS} 个)`, 'warn');
    return;
  }
  state.traits.push({ name:'', desc:'' }); renderTraits();
}
export function updateTrait(i,k,v){ state.traits[i][k] = v; }
export function removeTrait(i)    { state.traits.splice(i,1); renderTraits(); }

export function renderFeats() {
  if (!dom.featList) return;
  const count = state.feats.length;
  const remaining = MAX_FEATS - count;
  const presets = getAllFeats(state.theme);
  const names = new Set(state.feats.map(f => f.name));
  const available = presets.filter(p => !names.has(p.name));
  const presetHTML = available.length && remaining
    ? `<div class="preset-tags"><span style="font-size:.68rem;color:var(--text-dim);">快速添加:</span>${available.map(p =>
        `<span class="preset-tag" onclick="document.dispatchEvent(new CustomEvent('preset-feat-add',{detail:{name:'${esc(p.name).replace(/'/g, "\\'")}',desc:'${esc(p.desc).replace(/'/g, "\\'")}'}}))">${esc(p.name)}</span>`
      ).join('')}</div>`
    : '';
  dom.featList.innerHTML = (count === 0
    ? `<div class="empty-state">暂无专长，点击下方按钮添加 (最多 ${MAX_FEATS} 个)</div>`
    : state.feats.map((f, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(f.name)}" placeholder="专长名" onchange="document.dispatchEvent(new CustomEvent('feat-update',{detail:{i:${i},k:'name',v:this.value}}))">
        <input class="inline-input wide" value="${esc(f.desc)}" placeholder="效果" onchange="document.dispatchEvent(new CustomEvent('feat-update',{detail:{i:${i},k:'desc',v:this.value}}))">
        ${f.name ? `<span class="preset-save" title="保存为自定义预设" onclick="document.dispatchEvent(new CustomEvent('preset-feat-save',{detail:{i:${i}}}))">⬇</span>` : ''}
        <span class="trait-remove" onclick="document.dispatchEvent(new CustomEvent('feat-remove',{detail:${i}}))">×</span>
      </div>`).join(''))
    + `<div style="font-size:.7rem;color:var(--text-dim);margin-top:4px;">${count}/${MAX_FEATS} ${remaining ? '还可添加 ' + remaining + ' 个' : '已达上限'}</div>`
    + presetHTML;
}

export function addFeat() {
  if (state.feats.length >= MAX_FEATS) {
    showToast(`专长数量已达上限 (${MAX_FEATS} 个)`, 'warn');
    return;
  }
  state.feats.push({ name:'', desc:'' }); renderFeats();
}
export function updateFeat(i,k,v) { state.feats[i][k] = v; }
export function removeFeat(i)     { state.feats.splice(i,1); renderFeats(); }

// ── Equipment (Expanded) ─────────────────────────
export function renderEquipment() {
  if (!dom.equipTable) return;
  if (!state.equipment.length) {
    dom.equipTable.innerHTML = '<tr><td colspan="6"><div class="empty-state">暂无装备</div></td></tr>';
    return;
  }
  dom.equipTable.innerHTML = state.equipment.map((eq, i) => `
    <tr>
      <td>${esc(eq.name)}${eq.desc ? ' <span style="font-size:.72rem;color:var(--text-dim);">' + esc(eq.desc.substring(0,40)) + (eq.desc.length>40?'...':'') + '</span>' : ''}</td>
      <td>${eq.qty || 1}</td>
      <td style="color:var(--text-dim);">${esc(eq.weight || '—')}</td>
      <td style="color:var(--text-dim);">${esc(eq.category || '—')}</td>
      <td>${eq.equipped ? '<span style="color:var(--accent);">✓</span>' : '<span style="color:var(--text-dim);">—</span>'}</td>
      <td style="text-align:right;">
        <button class="equip-del-btn" onclick="document.dispatchEvent(new CustomEvent('equip-toggle',{detail:${i}}))" title="切换装备状态">${eq.equipped ? '卸' : '装'}</button>
        <button class="equip-del-btn" onclick="document.dispatchEvent(new CustomEvent('equip-remove',{detail:${i}}))">🗑️</button>
      </td>
    </tr>`).join('');
}

export function addEquipment() {
  const name = dom.equipName?.value.trim();
  if (!name) return;
  state.equipment.push({
    name,
    qty: parseInt(dom.equipQty?.value) || 1,
    weight: dom.equipWeight?.value.trim() || '',
    desc: dom.equipDesc?.value.trim() || '',
    equipped: false,
    category: dom.equipCategory?.value.trim() || ''
  });
  if (dom.equipName) dom.equipName.value = '';
  if (dom.equipQty) dom.equipQty.value = '1';
  if (dom.equipWeight) dom.equipWeight.value = '';
  if (dom.equipDesc) dom.equipDesc.value = '';
  if (dom.equipCategory) dom.equipCategory.value = '';
  renderEquipment();
}

export function removeEquip(i) { state.equipment.splice(i, 1); renderEquipment(); }
export function toggleEquip(i) {
  const eq = state.equipment[i];
  if (eq) { eq.equipped = !eq.equipped; renderEquipment(); }
}

// ── Era Presets (CoC) ────────────────────────────
export function renderEraSelector() {
  const el = dom.charEra;
  if (!el) return;
  el.innerHTML = Object.values(COC_ERAS).map(e =>
    `<option value="${e.id}" ${state.era === e.id ? 'selected' : ''}>${e.name}</option>`
  ).join('');
}

export function applyEra(eraKey) {
  const era = COC_ERAS[eraKey];
  if (!era) return;
  state.era = eraKey;

  // Reset all CoC skills to their base values
  const cocSkills = SKILL_DEFINITIONS.coc || [];
  for (const s of cocSkills) {
    const base = s.base || 0;
    state.skills[s.id] = { value: base, proficient: false };
  }
  // Apply era skill defaults
  if (era.skillDefaults) {
    for (const [skillId, val] of Object.entries(era.skillDefaults)) {
      if (!state.skills[skillId]) state.skills[skillId] = { value: 0, proficient: false };
      state.skills[skillId].value = val;
    }
  }
  // Update background placeholder
  const bgEl = document.getElementById('charBackground');
  if (bgEl && era.backgroundOptions) {
    bgEl.placeholder = '建议: ' + era.backgroundOptions.join('、');
  }
  renderSkills();
  renderEraSelector();
  if (dom.eraInfo) {
    dom.eraInfo.textContent = era.desc.substring(0, 80) + '...';
    dom.eraInfo.style.display = 'block';
  }
  showToast(`已切换至: ${era.name}`);
}

export function validateCharacterForEra() {
  const era = COC_ERAS[state.era];
  if (!era) return [];
  const warnings = [];
  const bg = document.getElementById('charBackground')?.value?.trim();
  if (bg && era.backgroundOptions?.length) {
    const match = era.backgroundOptions.some(opt => bg.includes(opt));
    if (!match) warnings.push(`背景"${bg}"可能不符合${era.name}的时代设定`);
  }
  return warnings;
}

// ── Character Persistence ────────────────────────
export function getCharData() {
  return {
    id: state.currentCharId || Date.now().toString(),
    name:       document.getElementById('charName')?.value,
    race:       document.getElementById('charRace')?.value,
    cls:        document.getElementById('charClass')?.value,
    level:      document.getElementById('charLevel')?.value,
    xp:         document.getElementById('charXP')?.value,
    background: document.getElementById('charBackground')?.value,
    alignment:  document.getElementById('charAlignment')?.value,
    hp:         document.getElementById('charHP')?.value,
    maxHp:      document.getElementById('charMaxHP')?.value,
    san:        document.getElementById('charSan')?.value,
    maxSan:     document.getElementById('charMaxSan')?.value,
    ac:         document.getElementById('charAC')?.value,
    init:       document.getElementById('charInit')?.value,
    attributes: { ...state.attributes },
    skills:     JSON.parse(JSON.stringify(state.skills)),
    spells:     state.spells.map(s => ({ ...s })),
    traits:     state.traits.map(t => ({ ...t })),
    feats:      state.feats.map(f => ({ ...f })),
    equipment:  state.equipment.map(e => ({ ...e })),
    portrait:   state.portraitData,
    theme:      state.theme,
    era:        state.era,
    savedAt:    new Date().toISOString(),
  };
}

export function loadCharData(data) {
  state.currentCharId = data.id;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; };
  setVal('charName', data.name);
  setVal('charRace', data.race);
  setVal('charClass', data.cls);
  setVal('charLevel', data.level || 1);
  setVal('charXP', data.xp);
  setVal('charBackground', data.background);
  setVal('charAlignment', data.alignment);
  // During active gameplay, HP/SAN are managed live by the game — don't overwrite
  if (!kpState.active) {
    setVal('charHP', data.hp || data.maxHp || 100);
    setVal('charMaxHP', data.maxHp || 100);
    setVal('charSan', data.san || data.maxSan || 100);
    setVal('charMaxSan', data.maxSan || 100);
  }
  setVal('charAC', data.ac);
  setVal('charInit', data.init);
  state.attributes = data.attributes || Object.fromEntries(ATTR_KEYS.map(k => [k, ATTR_BASE]));

  // Skills: backward-compatible loading
  if (data.skills) {
    const sampleKey = Object.keys(data.skills)[0];
    const isOldFormat = sampleKey && typeof data.skills[sampleKey] === 'boolean';
    if (isOldFormat) {
      // Old format: { "Athletics": true, ... } → convert to new { athletics: { value, proficient } }
      const converted = {};
      const level = parseInt(data.level) || 1;
      const profBonus = getProfBonus(level);
      const dndSkills = SKILL_DEFINITIONS.dnd || [];
      for (const s of dndSkills) {
        const attrVal = (data.attributes || {})[s.attr] || ATTR_BASE;
        const attrMod = modPctNum(attrVal);
        const prof = !!data.skills[s.name];
        converted[s.id] = { value: attrMod + (prof ? profBonus : 0), proficient: prof };
      }
      // Also check for CoC old format
      const cocSkills = SKILL_DEFINITIONS.coc || [];
      for (const s of cocSkills) {
        if (data.skills[s.name] !== undefined) {
          converted[s.id] = { value: data.skills[s.name] === true ? (s.base || 0) : (s.base || 0), proficient: data.skills[s.name] === true };
        }
      }
      state.skills = converted;
    } else {
      state.skills = data.skills;
    }
  } else {
    state.skills = {};
  }

  state.spells     = data.spells || [];
  state.traits     = data.traits || [];
  state.feats      = data.feats || [];
  state.equipment  = data.equipment || [];
  state.era        = data.era || 'classic';
  state.portraitData = data.portrait || null;

  // Normalize equipment: ensure new fields exist on old saves
  for (const eq of state.equipment) {
    if (eq.weight === undefined) eq.weight = '';
    if (eq.desc === undefined) eq.desc = '';
    if (eq.equipped === undefined) eq.equipped = false;
    if (eq.category === undefined) eq.category = '';
  }

  if (data.portrait) {
    if (dom.portraitImg) { dom.portraitImg.src = data.portrait; dom.portraitImg.style.display = 'block'; }
    if (dom.portraitPlaceholder) dom.portraitPlaceholder.style.display = 'none';
  } else {
    if (dom.portraitImg) dom.portraitImg.style.display = 'none';
    if (dom.portraitPlaceholder) dom.portraitPlaceholder.style.display = '';
  }
  renderAllCharacter();
}

export function renderAllCharacter() {
  renderAttributes(); renderSkills(); renderSpells(); renderTraits();
  renderFeats(); renderEquipment(); renderEraSelector(); renderSavedChars();
  // Re-apply lock state in case game is active
  setCharacterCardLock(kpState.active);
}

/** Lock/unlock the character card during active gameplay to prevent manual editing. */
export function setCharacterCardLock(locked) {
  const overlay = document.getElementById('charLockOverlay');
  if (overlay) overlay.style.display = locked ? '' : 'none';
}

export function saveCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先输入角色姓名'); return; }
  const warnings = validateCharacterForEra();
  if (warnings.length) {
    showToast('警告: ' + warnings.join('; '));
  }
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  chars[data.id] = data;
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  state.currentCharId = data.id;
  renderSavedChars();
  document.dispatchEvent(new CustomEvent('char-list-changed'));
  showToast(`角色 "${data.name}" 已保存!`);
}

export function renderSavedChars() {
  const list = dom.savedCharsList;
  if (!list) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const entries = Object.values(chars);
  if (!entries.length) {
    list.innerHTML = '<div class="empty-state">暂无保存的角色</div>';
    return;
  }
  list.innerHTML = entries.map(c => `
    <div class="game-save-item" data-action="character:load" data-id="${c.id}">
      <div>
        <div class="game-save-name">${esc(c.name)}</div>
        <div class="game-save-meta">
          ${esc(c.race||'?')} ${esc(c.cls||'?')} · Lv.${c.level||1}
          ${c.theme === 'coc' ? ' · SAN:' + (c.san || c.maxSan || 100) : ''}
        </div>
      </div>
      <button class="equip-del-btn" data-action="character:delete" data-id="${c.id}">🗑️</button>
    </div>`).join('');
}

export function loadCharacter(id) {
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  if (chars[id]) { loadCharData(chars[id]); state.currentCharId = id; document.dispatchEvent(new CustomEvent('char-list-changed')); showToast('角色已加载'); }
}

export function deleteCharacter(id) {
  if (!confirm('确定要删除该角色吗？')) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  delete chars[id];
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  if (state.currentCharId === id) state.currentCharId = null;
  renderSavedChars();
  document.dispatchEvent(new CustomEvent('char-list-changed'));
  showToast('角色已删除');
}

export function exportCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先创建角色'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${data.name}.json`; a.click();
  URL.revokeObjectURL(a.href);
  showToast('角色已导出');
}

export function importCharacterPrompt() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try { loadCharData(JSON.parse(ev.target.result)); showToast('角色已导入! 记得保存哦'); }
      catch (_) { showToast('文件格式错误'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── Initiative Tracker ───────────────────────────
export function renderInitiative() {
  const list = dom.initiativeList;
  if (!list) return;
  if (!state.initiative.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;padding:8px;text-align:center;">暂无先攻条目</div>';
    return;
  }
  const sorted = [...state.initiative].sort((a, b) => b.roll - a.roll);
  list.innerHTML = sorted.map((item, idx) => `
    <div class="init-row ${idx === 0 ? 'active-turn' : ''}">
      <div class="init-num">${item.roll}</div>
      <div class="init-name">${esc(item.name)}</div>
      <div class="init-hp">HP: ${item.hp || '?'}</div>
      <button class="equip-del-btn" data-action="character:removeInitiative" data-id="${item.id}">×</button>
    </div>`).join('');
}

export function addInitiative() {
  const name = dom.initName?.value.trim();
  const roll = parseInt(dom.initRoll?.value) || 0;
  if (!name) { showToast('请输入角色名称'); return; }
  state.initiative.push({ id: state.initNextId++, name, roll, hp: '' });
  if (dom.initName) dom.initName.value = '';
  if (dom.initRoll) dom.initRoll.value = '';
  renderInitiative();
}

export function removeInitiative(id) {
  state.initiative = state.initiative.filter(i => i.id !== id);
  renderInitiative();
}

export function nextInitiative() {
  if (state.initiative.length < 2) return;
  const first = state.initiative.shift();
  state.initiative.push(first);
  renderInitiative();
}

export function clearInitiative() {
  state.initiative = [];
  renderInitiative();
}
