// ==================== CHARACTER SHEET ====================
import { state, ATTR_KEYS, ATTR_NAMES, ATTR_COLORS, ATTR_BASE, ATTR_MAX, ATTR_POOL, DND_SKILLS } from './state.js';
import { esc, showToast, modPct, modPctNum } from './utils.js';
import { dom } from './dom.js';

// ── Portrait ─────────────────────────────────────
function handlePortraitFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    state.portraitData = ev.target.result;
    if (dom.portraitImg) {
      dom.portraitImg.src = ev.target.result;
      dom.portraitImg.style.display = 'block';
    }
    if (dom.portraitPlaceholder) dom.portraitPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
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

// ── Skills ───────────────────────────────────────
export function renderSkills() {
  const list = dom.skillsList;
  if (!list) return;
  list.innerHTML = DND_SKILLS.map(s => {
    const attrVal = state.attributes[s.attr];
    const baseMod = modPctNum(attrVal);
    const prof = state.skills[s.name] || false;
    const total = baseMod + (prof ? 3 : 0);
    const totalStr = total >= 0 ? `+${total}` : `${total}`;
    return `
      <div class="skill-chip ${prof ? 'proficient' : ''}" data-action="character:toggleSkill" data-skill="${s.name}">
        <span class="skill-dot ${prof ? 'on' : 'off'}"></span>
        <span class="skill-name">${s.name} <small style="color:var(--text-dim)">(${s.attr.toUpperCase()})</small></span>
        <span class="skill-bonus">${totalStr}</span>
      </div>`;
  }).join('');
}

export function toggleSkill(name) {
  state.skills[name] = !state.skills[name];
  renderSkills();
}

// ── Traits & Feats ───────────────────────────────
export function renderTraits() {
  if (!dom.traitList) return;
  dom.traitList.innerHTML = state.traits.length === 0
    ? '<div style="color:var(--text-dim);font-size:.8rem;padding:8px;">暂无特质，点击下方按钮添加</div>'
    : state.traits.map((t, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(t.name)}" placeholder="名称" onchange="document.dispatchEvent(new CustomEvent('trait-update',{detail:{i:${i},k:'name',v:this.value}}))">
        <input class="inline-input wide" value="${esc(t.desc)}" placeholder="描述" onchange="document.dispatchEvent(new CustomEvent('trait-update',{detail:{i:${i},k:'desc',v:this.value}}))">
        <span class="trait-remove" onclick="document.dispatchEvent(new CustomEvent('trait-remove',{detail:${i}}))">×</span>
      </div>`).join('');
}

export function addTrait()       { state.traits.push({ name:'', desc:'' }); renderTraits(); }
export function updateTrait(i,k,v){ state.traits[i][k] = v; }
export function removeTrait(i)    { state.traits.splice(i,1); renderTraits(); }

export function renderFeats() {
  if (!dom.featList) return;
  dom.featList.innerHTML = state.feats.length === 0
    ? '<div style="color:var(--text-dim);font-size:.8rem;padding:8px;">暂无专长，点击下方按钮添加</div>'
    : state.feats.map((f, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(f.name)}" placeholder="专长名" onchange="document.dispatchEvent(new CustomEvent('feat-update',{detail:{i:${i},k:'name',v:this.value}}))">
        <input class="inline-input wide" value="${esc(f.desc)}" placeholder="效果" onchange="document.dispatchEvent(new CustomEvent('feat-update',{detail:{i:${i},k:'desc',v:this.value}}))">
        <span class="trait-remove" onclick="document.dispatchEvent(new CustomEvent('feat-remove',{detail:${i}}))">×</span>
      </div>`).join('');
}

export function addFeat()         { state.feats.push({ name:'', desc:'' }); renderFeats(); }
export function updateFeat(i,k,v) { state.feats[i][k] = v; }
export function removeFeat(i)     { state.feats.splice(i,1); renderFeats(); }

// ── Equipment ────────────────────────────────────
export function renderEquipment() {
  if (!dom.equipTable) return;
  dom.equipTable.innerHTML = state.equipment.length === 0
    ? '<tr><td colspan="3" style="color:var(--text-dim);text-align:center;padding:16px;">暂无装备</td></tr>'
    : state.equipment.map((eq, i) => `
      <tr>
        <td>${esc(eq.name)}</td>
        <td style="color:var(--text-dim);">${eq.qty || 1}</td>
        <td style="text-align:right;"><button class="equip-del-btn" onclick="document.dispatchEvent(new CustomEvent('equip-remove',{detail:${i}}))">🗑️</button></td>
      </tr>`).join('');
}

export function addEquipment() {
  const name = dom.equipName?.value.trim();
  if (!name) return;
  state.equipment.push({ name, qty: parseInt(dom.equipQty?.value) || 1 });
  if (dom.equipName) dom.equipName.value = '';
  if (dom.equipQty) dom.equipQty.value = '';
  renderEquipment();
}

export function removeEquip(i) { state.equipment.splice(i,1); renderEquipment(); }

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
    ac:         document.getElementById('charAC')?.value,
    init:       document.getElementById('charInit')?.value,
    attributes: { ...state.attributes },
    skills:     { ...state.skills },
    traits:     state.traits.map(t=>({...t})),
    feats:      state.feats.map(f=>({...f})),
    equipment:  state.equipment.map(e=>({...e})),
    portrait:   state.portraitData,
    theme:      state.theme,
    savedAt:    new Date().toISOString(),
  };
}

export function loadCharData(data) {
  state.currentCharId = data.id;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('charName', data.name);
  setVal('charRace', data.race);
  setVal('charClass', data.cls);
  setVal('charLevel', data.level || 1);
  setVal('charXP', data.xp);
  setVal('charBackground', data.background);
  setVal('charAlignment', data.alignment);
  setVal('charHP', data.hp);
  setVal('charMaxHP', data.maxHp);
  setVal('charAC', data.ac);
  setVal('charInit', data.init);
  state.attributes = data.attributes || Object.fromEntries(ATTR_KEYS.map(k=>[k,ATTR_BASE]));
  state.skills     = data.skills || {};
  state.traits     = data.traits || [];
  state.feats      = data.feats || [];
  state.equipment  = data.equipment || [];
  state.portraitData = data.portrait || null;
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
  renderAttributes(); renderSkills(); renderTraits();
  renderFeats(); renderEquipment(); renderSavedChars();
}

export function saveCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先输入角色姓名'); return; }
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  chars[data.id] = data;
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  state.currentCharId = data.id;
  renderSavedChars();
  showToast(`角色 "${data.name}" 已保存!`);
}

export function renderSavedChars() {
  const list = dom.savedCharsList;
  if (!list) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const entries = Object.values(chars);
  if (!entries.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:12px;">暂无保存的角色</div>';
    return;
  }
  list.innerHTML = entries.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:6px;cursor:pointer;transition:all var(--t);" data-action="character:load" data-id="${c.id}" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <div>
        <div style="font-weight:600;color:var(--text);">${esc(c.name)}</div>
        <div style="font-size:.78rem;color:var(--text-dim);">${esc(c.race||'?')} ${esc(c.cls||'?')} · Lv.${c.level||1}</div>
      </div>
      <span style="color:var(--accent2);cursor:pointer;padding:4px 8px;font-size:.85rem;" data-action="character:delete" data-id="${c.id}">🗑️</span>
    </div>`).join('');
}

export function loadCharacter(id) {
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  if (chars[id]) { loadCharData(chars[id]); showToast('角色已加载'); }
}

export function deleteCharacter(id) {
  if (!confirm('确定要删除该角色吗？')) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  delete chars[id];
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  if (state.currentCharId === id) state.currentCharId = null;
  renderSavedChars();
  showToast('角色已删除');
}

export function exportCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先创建角色'); return; }
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${data.name}.json`; a.click();
  URL.revokeObjectURL(a.href);
  showToast('角色已导出');
}

export function importCharacterPrompt() {
  const input = document.createElement('input'); input.type='file'; input.accept='.json';
  input.onchange = function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try { loadCharData(JSON.parse(ev.target.result)); showToast('角色已导入! 记得保存哦'); }
      catch(_) { showToast('文件格式错误'); }
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
  const sorted = [...state.initiative].sort((a,b) => b.roll - a.roll);
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
