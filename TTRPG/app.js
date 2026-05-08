/* ============================================================
   TTRPG Companion — Application Logic
   ============================================================ */
(function () {
'use strict';

// ==================== STATE ====================
const ATTR_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ATTR_NAMES = {
  str: '力量 STR', dex: '敏捷 DEX', con: '体质 CON',
  int: '智力 INT', wis: '感知 WIS', cha: '魅力 CHA'
};

// Attribute bar colors per stat
const ATTR_COLORS = {
  str: '#d4443a', dex: '#4aac4a', con: '#e89030',
  int: '#4488dd', wis: '#aa88cc', cha: '#e86090'
};

const DND_SKILLS = [
  { name:'运动', attr:'str' }, { name:'杂技', attr:'dex' },
  { name:'巧手', attr:'dex' }, { name:'隐匿', attr:'dex' },
  { name:'奥秘', attr:'int' }, { name:'历史', attr:'int' },
  { name:'调查', attr:'int' }, { name:'自然', attr:'int' },
  { name:'宗教', attr:'int' }, { name:'驯兽', attr:'wis' },
  { name:'洞察', attr:'wis' }, { name:'医药', attr:'wis' },
  { name:'察觉', attr:'wis' }, { name:'生存', attr:'wis' },
  { name:'欺瞒', attr:'cha' }, { name:'威吓', attr:'cha' },
  { name:'表演', attr:'cha' }, { name:'游说', attr:'cha' }
];

const THEME_NAMES = {
  dnd: 'D&D 5e', coc: '克苏鲁的呼唤',
  cyberpunk: '赛博朋克 RED', pathfinder: '开拓者'
};

// Percentage attribute system constants
const ATTR_BASE  = 20;   // minimum / starting value
const ATTR_MAX   = 100;  // maximum value
const ATTR_POOL  = 240;  // total points to distribute (so average = 20+40 = 60)

let state = {
  theme: 'dnd',
  currentDice: 20,
  attributes: { str:20, dex:20, con:20, int:20, wis:20, cha:20 },
  skills: {},
  traits: [],
  feats: [],
  equipment: [],
  portraitData: null,
  rollHistory: [],
  currentCharId: null,
  initiative: [],
  initNextId: 1,
};

// ==================== DOM REFS ====================
const $ = id => document.getElementById(id);
const dom = {
  get particles()     { return $('particles'); },
  get themeBadge()    { return $('themeBadge'); },
  get attrGrid()      { return $('attrGrid'); },
  get ptsRemaining()  { return $('ptsRemaining'); },
  get skillsList()    { return $('skillsList'); },
  get traitList()     { return $('traitList'); },
  get featList()      { return $('featList'); },
  get equipTable()    { return $('equipTable'); },
  get equipName()     { return $('equipName'); },
  get equipQty()      { return $('equipQty'); },
  get savedCharsList(){ return $('savedCharsList'); },
  get diceResultBig() { return $('diceResultBig'); },
  get diceResultLabel(){return $('diceResultLabel'); },
  get rollBtnLabel()  { return $('rollBtnLabel'); },
  get rollHistory()   { return $('rollHistory'); },
  get customDice()    { return $('customDice'); },
  get sessionsList()  { return $('sessionsList'); },
  get sessionTitle()  { return $('sessionTitle'); },
  get sessionContent(){ return $('sessionContent'); },
  get apiResults()    { return $('apiResults'); },
  get initiativeList(){ return $('initiativeList'); },
  get initName()      { return $('initName'); },
  get initRoll()      { return $('initRoll'); },
  get portraitZone()  { return $('portraitZone'); },
  get portraitImg()   { return $('portraitImg'); },
  get portraitPlaceholder() { return $('portraitPlaceholder'); },
};

// ==================== UTILS ====================
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.remove(); if (!container.children.length) container.remove(); }, 3000);
}

function modPct(val) {
  // 50 = 0 modifier, each 5 points = +1 or -1
  const m = Math.floor((val - 50) / 5);
  return m >= 0 ? `+${m}` : `${m}`;
}

function modPctNum(val) {
  return Math.floor((val - 50) / 5);
}

// ==================== THEME ====================
function selectRPG(theme) {
  state.theme = theme;
  document.body.setAttribute('data-theme', theme);
  dom.themeBadge.textContent = THEME_NAMES[theme];
  document.querySelectorAll('.rpg-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.rpg-card[data-theme="${theme}"]`);
  if (card) card.classList.add('selected');
  localStorage.setItem('ttrpg-theme', theme);
  // Update KP UI
  const kpTheme = document.getElementById('kpCurrentTheme');
  if (kpTheme) kpTheme.textContent = THEME_NAMES[theme];
  renderKPQuickActions();
  // Init CoC state if switching to CoC
  if (theme === 'coc' && cocState.chronicle.length === 0) { initCocState(); }
  renderCocStatus();
  renderCocChronicle();
  showToast(`已切换到 ${THEME_NAMES[theme]} 主题`);
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
  if (tab) tab.classList.add('active');
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');

  // Refresh page-specific content
  if (page === 'character') { renderAllCharacter(); }
  if (page === 'dice')      { renderRollHistory(); }
  if (page === 'notes')     { renderSessions(); }
  if (page === 'home')      { renderKPQuickActions(); renderKP(); renderCocStatus(); renderCocChronicle(); renderGameSaves(); }
  if (page === 'multiplayer') { Multiplayer.onPageOpen(); }
}

// ==================== PORTRAIT ====================
function handlePortraitFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    state.portraitData = ev.target.result;
    dom.portraitImg.src = ev.target.result;
    dom.portraitImg.style.display = 'block';
    dom.portraitPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function setupPortrait() {
  const zone = dom.portraitZone;
  zone.addEventListener('click', () => $('portraitInput').click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handlePortraitFile(e.dataTransfer.files[0]);
  });

  $('portraitInput').addEventListener('change', e => {
    handlePortraitFile(e.target.files[0]);
  });
}

// ==================== ATTRIBUTES (百分制) ====================
function ptsUsed() {
  let used = 0;
  for (const k of ATTR_KEYS) { used += state.attributes[k] - ATTR_BASE; }
  return used;
}

function ptsRemaining() {
  return ATTR_POOL - ptsUsed();
}

function barColor(val, baseColor) {
  // Darker at low values, brighter at high
  if (val < 30) return '#555';
  if (val < 50) return baseColor; // slightly muted via opacity in css
  if (val < 75) return baseColor;
  if (val < 90) return baseColor; // bright
  return '#ffcc00'; // gold at very high
}

function renderAttributes() {
  const grid = dom.attrGrid;
  const remaining = ptsRemaining();
  let html = '';

  for (const k of ATTR_KEYS) {
    const v = state.attributes[k];
    const mod = modPct(v);
    const pct = v; // 0–100, directly the percentage
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
          <button class="attr-bar-btn" onclick="App.adjustAttr('${k}',-5)" ${v - 5 < ATTR_BASE ? 'disabled style="opacity:.25"' : ''}>−5</button>
          <button class="attr-bar-btn" onclick="App.adjustAttr('${k}',-1)" ${v - 1 < ATTR_BASE ? 'disabled style="opacity:.25"' : ''}>−</button>
          <button class="attr-bar-btn" onclick="App.adjustAttr('${k}',+1)" ${remaining < 1 || v + 1 > ATTR_MAX ? 'disabled style="opacity:.25"' : ''}>+</button>
          <button class="attr-bar-btn" onclick="App.adjustAttr('${k}',+5)" ${remaining < 5 || v + 5 > ATTR_MAX ? 'disabled style="opacity:.25"' : ''}>+5</button>
        </div>
      </div>`;
  }

  grid.innerHTML = html;

  dom.ptsRemaining.textContent = `可分配点数: ${remaining} / ${ATTR_POOL}`;
  dom.ptsRemaining.style.color = remaining < 20 ? 'var(--accent2)' : 'var(--text-gold)';
}

function adjustAttr(attr, delta) {
  const newVal = state.attributes[attr] + delta;
  if (newVal < ATTR_BASE || newVal > ATTR_MAX) return;
  const newUsed = ptsUsed() - (state.attributes[attr] - ATTR_BASE) + (newVal - ATTR_BASE);
  if (newUsed > ATTR_POOL) return;
  state.attributes[attr] = newVal;
  renderAttributes();
  renderSkills();
}

// ==================== SKILLS ====================
function renderSkills() {
  const list = dom.skillsList;
  list.innerHTML = DND_SKILLS.map(s => {
    const attrVal = state.attributes[s.attr];
    const baseMod = modPctNum(attrVal);
    const prof = state.skills[s.name] || false;
    const total = baseMod + (prof ? 3 : 0); // proficiency = +3 at this abstraction
    const totalStr = total >= 0 ? `+${total}` : `${total}`;
    return `
      <div class="skill-chip ${prof ? 'proficient' : ''}" onclick="App.toggleSkill('${s.name}')">
        <span class="skill-dot ${prof ? 'on' : 'off'}"></span>
        <span class="skill-name">${s.name} <small style="color:var(--text-dim)">(${s.attr.toUpperCase()})</small></span>
        <span class="skill-bonus">${totalStr}</span>
      </div>`;
  }).join('');
}

function toggleSkill(name) {
  state.skills[name] = !state.skills[name];
  renderSkills();
}

// ==================== TRAITS & FEATS ====================
function renderTraits() {
  dom.traitList.innerHTML = state.traits.length === 0
    ? '<div style="color:var(--text-dim);font-size:.8rem;padding:8px;">暂无特质，点击下方按钮添加</div>'
    : state.traits.map((t, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(t.name)}" placeholder="名称" onchange="App.updateTrait(${i},'name',this.value)">
        <input class="inline-input wide" value="${esc(t.desc)}" placeholder="描述" onchange="App.updateTrait(${i},'desc',this.value)">
        <span class="trait-remove" onclick="App.removeTrait(${i})">×</span>
      </div>`).join('');
}

function addTrait()       { state.traits.push({ name:'', desc:'' }); renderTraits(); }
function updateTrait(i,k,v){ state.traits[i][k] = v; }
function removeTrait(i)    { state.traits.splice(i,1); renderTraits(); }

function renderFeats() {
  dom.featList.innerHTML = state.feats.length === 0
    ? '<div style="color:var(--text-dim);font-size:.8rem;padding:8px;">暂无专长，点击下方按钮添加</div>'
    : state.feats.map((f, i) => `
      <div class="trait-tag">
        <input class="inline-input" value="${esc(f.name)}" placeholder="专长名" onchange="App.updateFeat(${i},'name',this.value)">
        <input class="inline-input wide" value="${esc(f.desc)}" placeholder="效果" onchange="App.updateFeat(${i},'desc',this.value)">
        <span class="trait-remove" onclick="App.removeFeat(${i})">×</span>
      </div>`).join('');
}

function addFeat()         { state.feats.push({ name:'', desc:'' }); renderFeats(); }
function updateFeat(i,k,v) { state.feats[i][k] = v; }
function removeFeat(i)     { state.feats.splice(i,1); renderFeats(); }

// ==================== EQUIPMENT ====================
function renderEquipment() {
  dom.equipTable.innerHTML = state.equipment.length === 0
    ? '<tr><td colspan="3" style="color:var(--text-dim);text-align:center;padding:16px;">暂无装备</td></tr>'
    : state.equipment.map((eq, i) => `
      <tr>
        <td>${esc(eq.name)}</td>
        <td style="color:var(--text-dim);">${eq.qty || 1}</td>
        <td style="text-align:right;"><button class="equip-del-btn" onclick="App.removeEquip(${i})">🗑️</button></td>
      </tr>`).join('');
}

function addEquipment() {
  const name = dom.equipName.value.trim();
  if (!name) return;
  state.equipment.push({ name, qty: parseInt(dom.equipQty.value) || 1 });
  dom.equipName.value = ''; dom.equipQty.value = '';
  renderEquipment();
}
function removeEquip(i) { state.equipment.splice(i,1); renderEquipment(); }

// ==================== CHARACTER PERSISTENCE ====================
function getCharData() {
  return {
    id: state.currentCharId || Date.now().toString(),
    name:       $('charName').value,
    race:       $('charRace').value,
    cls:        $('charClass').value,
    level:      $('charLevel').value,
    xp:         $('charXP').value,
    background: $('charBackground').value,
    alignment:  $('charAlignment').value,
    hp:         $('charHP').value,
    maxHp:      $('charMaxHP').value,
    ac:         $('charAC').value,
    init:       $('charInit').value,
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

function loadCharData(data) {
  state.currentCharId = data.id;
  $('charName').value       = data.name || '';
  $('charRace').value       = data.race || '';
  $('charClass').value      = data.cls || '';
  $('charLevel').value      = data.level || 1;
  $('charXP').value         = data.xp || '';
  $('charBackground').value = data.background || '';
  $('charAlignment').value  = data.alignment || '';
  $('charHP').value         = data.hp || '';
  $('charMaxHP').value      = data.maxHp || '';
  $('charAC').value         = data.ac || '';
  $('charInit').value       = data.init || '';
  state.attributes = data.attributes || Object.fromEntries(ATTR_KEYS.map(k=>[k,ATTR_BASE]));
  state.skills     = data.skills || {};
  state.traits     = data.traits || [];
  state.feats      = data.feats || [];
  state.equipment  = data.equipment || [];
  state.portraitData = data.portrait || null;
  if (data.portrait) {
    dom.portraitImg.src = data.portrait;
    dom.portraitImg.style.display = 'block';
    dom.portraitPlaceholder.style.display = 'none';
  } else {
    dom.portraitImg.style.display = 'none';
    dom.portraitPlaceholder.style.display = '';
  }
  renderAllCharacter();
}

function renderAllCharacter() {
  renderAttributes(); renderSkills(); renderTraits();
  renderFeats(); renderEquipment(); renderSavedChars(); renderInitiative();
}

function saveCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先输入角色姓名'); return; }
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  chars[data.id] = data;
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  state.currentCharId = data.id;
  renderSavedChars();
  showToast(`角色 "${data.name}" 已保存!`);
}

function renderSavedChars() {
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const entries = Object.values(chars);
  const list = dom.savedCharsList;
  if (!entries.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:12px;">暂无保存的角色</div>';
    return;
  }
  list.innerHTML = entries.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:6px;cursor:pointer;transition:all var(--t);" onclick="App.loadCharacter('${c.id}')" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <div>
        <div style="font-weight:600;color:var(--text);">${esc(c.name)}</div>
        <div style="font-size:.78rem;color:var(--text-dim);">${esc(c.race||'?')} ${esc(c.cls||'?')} · Lv.${c.level||1}</div>
      </div>
      <span style="color:var(--accent2);cursor:pointer;padding:4px 8px;font-size:.85rem;" onclick="event.stopPropagation();App.deleteCharacter('${c.id}')">🗑️</span>
    </div>`).join('');
}

function loadCharacter(id) {
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  if (chars[id]) { loadCharData(chars[id]); showToast('角色已加载'); }
}

function deleteCharacter(id) {
  if (!confirm('确定要删除该角色吗？')) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  delete chars[id];
  localStorage.setItem('ttrpg-chars', JSON.stringify(chars));
  if (state.currentCharId === id) state.currentCharId = null;
  renderSavedChars();
  showToast('角色已删除');
}

function exportCharacter() {
  const data = getCharData();
  if (!data.name) { showToast('请先创建角色'); return; }
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${data.name}.json`; a.click();
  URL.revokeObjectURL(a.href);
  showToast('角色已导出');
}

function importCharacterPrompt() {
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

// ==================== DICE ROLLER ====================
function selectDice(dice, btn) {
  state.currentDice = dice;
  document.querySelectorAll('.dice-die').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  dom.rollBtnLabel.textContent = `d${dice}`;
}

function animateResult(num, label, extraClass) {
  const el = dom.diceResultBig;
  el.textContent = num;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'popIn .4s cubic-bezier(.68,-.55,.27,1.55)';
  el.className = 'dice-big-num ' + (extraClass || '');
  dom.diceResultLabel.textContent = label;
}

function rollDice() {
  const dice = state.currentDice;
  const result = Math.floor(Math.random() * dice) + 1;
  const is20  = dice === 20 && result === 20;
  const is1   = dice === 20 && result === 1;

  let cls = '';
  if (is20) { cls = 'crit-success'; dom.diceResultLabel.textContent = '🎉 自然20! 大成功!'; }
  else if (is1) { cls = 'crit-fail'; dom.diceResultLabel.textContent = '💀 自然1... 大失败...'; }
  else { dom.diceResultLabel.textContent = `d${dice} 投掷结果`; }

  animateResult(result, dom.diceResultLabel.textContent, cls);

  state.rollHistory.unshift({
    type:'single', dice, result, is20, is1,
    time: new Date().toLocaleTimeString()
  });
  if (state.rollHistory.length > 100) state.rollHistory.pop();
  renderRollHistory();

  // Broadcast to multiplayer room
  if (Multiplayer.connected) {
    const detail = is20 ? `🎉 d20 = ${result} 大成功!` : is1 ? `💀 d20 = ${result} 大失败...` : `d${dice} = ${result}`;
    Multiplayer.rollAndBroadcast(`d${dice}`);
  }
}

function rollCustom() {
  const input = dom.customDice.value.trim();
  const match = input.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) { showToast('格式错误! 例如: 2d6+3 或 d20'); return; }

  const count = parseInt(match[1]) || 1;
  const sides = parseInt(match[2]);
  const mod   = parseInt(match[3]) || 0;
  if (count > 100) { showToast('骰子数量不能超过100'); return; }
  if (sides > 1000){ showToast('骰子面数不能超过1000'); return; }

  const rolls = []; let total = 0;
  for (let i=0; i<count; i++) { const r = Math.floor(Math.random()*sides)+1; rolls.push(r); total += r; }
  total += mod;

  const detail = count > 1
    ? `${rolls.join('+')}${mod?(mod>0?'+'+mod:mod):''} = ${total}`
    : `${total}`;

  animateResult(total, `${input} → ${detail}`);

  state.rollHistory.unshift({
    type:'custom', dice:sides, count, mod, result:total, rolls, detail,
    time: new Date().toLocaleTimeString()
  });
  if (state.rollHistory.length > 100) state.rollHistory.pop();
  renderRollHistory();

  // Broadcast to multiplayer room
  if (Multiplayer.connected) {
    Multiplayer.rollAndBroadcast(input);
  }
}

function renderRollHistory() {
  const list = dom.rollHistory;
  if (!list) return;
  if (!state.rollHistory.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:20px;text-align:center;">暂无投掷记录</div>';
    return;
  }
  list.innerHTML = state.rollHistory.map(r => {
    const icon = r.is20 ? '🎉' : r.is1 ? '💀' : '🎲';
    const text = r.detail || `d${r.dice} = ${r.result}`;
    let cls = '';
    if (r.is20) cls = 'crit-success';
    if (r.is1)  cls = 'crit-fail';
    return `<div class="roll-entry">
      <span class="roll-icon">${icon}</span>
      <span class="roll-text">${text}</span>
      <span class="roll-val ${cls}">${r.result}</span>
      <span class="roll-time">${r.time}</span>
    </div>`;
  }).join('');
}

function clearRollHistory() {
  state.rollHistory = [];
  renderRollHistory();
  dom.diceResultBig.textContent = '—';
  dom.diceResultLabel.textContent = '选择骰子然后投掷';
}

// ==================== INITIATIVE TRACKER ====================
function renderInitiative() {
  const list = dom.initiativeList;
  if (!list) return;
  if (!state.initiative.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;padding:8px;text-align:center;">暂无先攻条目</div>';
    return;
  }
  // Sort by initiative roll descending
  const sorted = [...state.initiative].sort((a,b) => b.roll - a.roll);
  list.innerHTML = sorted.map((item, idx) => `
    <div class="init-row ${idx === 0 ? 'active-turn' : ''}">
      <div class="init-num">${item.roll}</div>
      <div class="init-name">${esc(item.name)}</div>
      <div class="init-hp">HP: ${item.hp || '?'}</div>
      <button class="equip-del-btn" onclick="App.removeInitiative(${item.id})">×</button>
    </div>`).join('');
}

function addInitiative() {
  const name = dom.initName.value.trim();
  const roll = parseInt(dom.initRoll.value) || 0;
  if (!name) { showToast('请输入角色名称'); return; }
  state.initiative.push({ id: state.initNextId++, name, roll, hp: '' });
  dom.initName.value = '';
  dom.initRoll.value = '';
  renderInitiative();
}

function removeInitiative(id) {
  state.initiative = state.initiative.filter(i => i.id !== id);
  renderInitiative();
}

function nextInitiative() {
  if (state.initiative.length < 2) return;
  const first = state.initiative.shift();
  state.initiative.push(first);
  renderInitiative();
}

function clearInitiative() {
  state.initiative = [];
  renderInitiative();
}

// ==================== SESSION NOTES ====================
function saveSessionNote() {
  const title   = dom.sessionTitle.value.trim();
  const content = dom.sessionContent.value.trim();
  if (!title && !content) { showToast('请先输入笔记内容'); return; }
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  sessions.unshift({
    id: Date.now().toString(),
    title: title || '未命名',
    content,
    date: new Date().toLocaleString(),
  });
  localStorage.setItem('ttrpg-notes', JSON.stringify(sessions));
  dom.sessionTitle.value = '';
  dom.sessionContent.value = '';
  renderSessions();
  showToast('笔记已保存!');
}

function renderSessions() {
  const list = dom.sessionsList;
  if (!list) return;
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  if (!sessions.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:20px;text-align:center;">暂无记录</div>';
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="note-card" onclick="App.loadSession('${s.id}')">
      <div class="note-date">${s.date}</div>
      <div class="note-title">${esc(s.title)}</div>
    </div>`).join('');
}

function loadSession(id) {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  const s = sessions.find(x => x.id === id);
  if (s) {
    dom.sessionTitle.value = s.title;
    dom.sessionContent.value = s.content;
    showToast('笔记已加载');
  }
}

// ==================== API ====================
const API_BASE = 'https://www.dnd5eapi.co/api';

async function fetchAPI(endpoint) {
  const container = dom.apiResults;
  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim);">⏳ 正在从 D&D 5e API 获取数据...</div>';
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    container.innerHTML =
      `<p style="color:var(--text-dim);margin-bottom:10px;font-size:.82rem;">共 ${data.count} 条结果，显示前 ${Math.min(data.results.length, 30)} 条</p>
       <div class="api-grid">${data.results.slice(0,30).map(item => `
        <div class="api-card" onclick="App.fetchAPIDetail('${endpoint}','${item.index}')">
          <h4>${item.name}</h4>
          <div class="api-desc">点击查看详情</div>
        </div>`).join('')}</div>`;
  } catch(err) {
    container.innerHTML = `<div style="color:var(--accent2);padding:16px;">⚠️ API 请求失败: ${err.message}<br><small>请检查网络，或尝试用 HTTP 服务器打开此页面。</small></div>`;
  }
}

async function fetchAPIDetail(endpoint, index) {
  const container = dom.apiResults;
  container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim);">⏳ 获取详情中...</div>';
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}/${index}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    let html = `<button class="btn btn-ghost btn-sm" style="margin-bottom:14px;" onclick="App.fetchAPI('${endpoint}')">← 返回列表</button>`;
    html += `<h3 style="color:var(--text-gold);margin-bottom:14px;font-family:var(--font-display);">${data.name}</h3>`;
    if (data.desc) {
      html += `<p style="color:var(--text-dim);line-height:1.7;margin-bottom:16px;">${Array.isArray(data.desc)?data.desc.join('<br>'):data.desc}</p>`;
    }
    const skip = ['index','name','url','desc'];
    html += '<div class="api-grid">';
    for (const [k,v] of Object.entries(data)) {
      if (skip.includes(k) || k.startsWith('_')) continue;
      if (v !== null && v !== undefined && v !== '') {
        const display = Array.isArray(v) ? v.map(x=>typeof x==='object'?x.name||'':x).filter(Boolean).join(', ') || '—'
          : typeof v==='object' ? (v.name || JSON.stringify(v).slice(0,80)) : String(v);
        html += `<div class="api-card"><h4>${k}</h4><div class="api-desc">${esc(display)}</div></div>`;
      }
    }
    html += '</div>';
    container.innerHTML = html;
  } catch(err) {
    container.innerHTML = `<div style="color:var(--accent2);padding:16px;">⚠️ 获取详情失败: ${err.message}</div>`;
  }
}

// ==================== AI KP (GAME MASTER) ====================
const KP_SYSTEM_PROMPTS = {
  dnd: `你是一位资深的龙与地下城(D&D 5e)地下城主(DM)。你正在为一位冒险者主持一场奇幻冒险。

规则系统: d20系统。技能检定、豁免检定、攻击检定均使用20面骰。
世界观: 被遗忘的国度。剑与魔法、巨龙、地城、诸神与凡人交织的史诗世界。

你的职责:
1. 用生动的语言描述场景、NPC、怪物和环境。营造奇幻史诗氛围。
2. 当玩家尝试行动时，决定是否需要检定，明确告知需要投什么骰子(例如"请进行一次 DC15 的察觉检定，投d20+你的感知调整值")。
3. 管理战斗:先攻顺序、攻击判定、伤害、法术效果。
4. 扮演所有NPC——从酒馆老板到远古巨龙。
5. 推动剧情发展，根据玩家选择产生合理的后果。
6. 控制节奏:精彩的叙事段落 + 关键决策点 + 紧张的战斗。

格式约定: 当需要玩家投骰时，用【检定: d20+调整值 DC难度】格式标注。描述场景用丰富的叙述文字。战斗信息可以结构化展示。`,

  coc: `你是克苏鲁的呼唤第七版(CoC 7e)的守秘人(Keeper/KP)。你必须严格遵循CoC 7e核心规则书。你的裁决是最终且不可上诉的。

## 核心规则系统 (d100)
- 属性范围15-90(3d6×5或2d6+6×5)。技能值1%-99%。
- 检定方式: 投d100，结果 ≤ 技能/属性值即成功。01-05恒为大成功。
- 难度等级: 常规(≤技能值)、困难(≤1/2技能值)、极难(≤1/5技能值)。
- 大失败: 技能值<50时96-100为大失败;技能值≥50时仅100为大失败。
- 奖励骰/惩罚骰: 投额外十位骰(个位不变)，取较优/较劣的十位数。
- 孤注一掷(Pushing): 失败后可声明重试，但需描述额外努力，且失败后果必须严重到改变局面。
- 幸运值(LUCK): 玩家可消耗幸运值等额降低检定结果(1点=1%)。幸运值不可恢复。

## 理智系统 (SAN) — 核心机制
- 初始SAN = POW。最大SAN = 99 - 克苏鲁神话技能值。
- SAN检定: d100≤SAN则成功。失败则损失SAN。
- SAN损失基准: 见到人类尸体0/1d3;见到非自然死亡0/1d4+1;遭遇怪物0/1d6;遭遇神话存在1d3/1d20+;阅读神话典籍1d4/2d8。
- 临时疯狂: 单次SAN损失≥5或在SAN检定失败后损失≥当前SAN的1/5。持续1d10小时或直到被约束。
- 不定性疯狂: 一天内SAN累计损失≥当前SAN的1/5。持续1d10个月或直到关键恢复。
- 疯狂表现: 恐惧症、躁狂症、幻觉、妄想、解离性障碍等——必须具体、有角色后果。
- SAN恢复: 完成模组+1d6;击败神话威胁+2d6;心理治疗每月+1d3(需成功精神分析检定)。
- SAN归零: 角色永久陷入疯狂，成为NPC。

## 战斗规则
- HP = (CON+SIZ)/10(向下取整)。重伤(HP=0): 每回合需CON检定维持意识。HP≤-2即死亡。
- 战斗顺序按DEX降序排列。每回合可执行一次攻击和一次闪避(或逃跑)。
- 格斗伤害基础1d3+伤害加值(db)。火器伤害见武器表。穿刺/枪伤有贯穿后果。
- 急救: 成功恢复1HP(需急救技能检定)。医学: 成功恢复1d3HP(需医学技能检定，只能由他人操作)。
- 自然恢复: 每周恢复1HP(需静养)。

## 追逐规则
- 追逃双方比较MOV(移动速度)。速度劣势方需每轮进行CON或DEX检定以避免落后。
- 障碍物需额外检定。车辆追逐使用驾驶技能。

## 神话典籍与魔法
- 阅读神话典籍: 需时间(数周至数月)，增加克苏鲁神话技能(CMI)，损失SAN。
- 学习法术: 需INT检定理解，消耗SAN，耗费时间。
- 施法: 消耗MP和/或SAN。有些法术消耗POW(永久)。
- MP = POW/5。MP每日自然恢复。

## 调查员发展阶段 (模组完成后)
- 技能提升检定: 在本模组中成功使用过的技能，投d100 > 当前技能值则增加1d10。
- 不可自然恢复的属性可通过训练(费时数月)提升。
- 年龄调整: 40岁后EDU可继续提升但STR/CON/DEX下降。

## KP权威与严格裁定
- 你是规则的绝对仲裁者。玩家的言辞不能改变物理法则、NPC自由意志或游戏现实。
- NPC不会轻易被说服: "我想说服警察局长无视谋杀案"→即使大成功，最多获得轻微通融而非完全免责。NPC有自身的利益、恐惧和底线。
- 宇宙恐怖不可战胜: 面对神话存在，常规武器几乎无效。调查员的死亡和疯狂是CoC的核心体验，不要回避它。
- "我说服古神离开" → 自动失败并损失2d20 SAN。
- 线索设置: 关键线索至少应有两条获取途径(三条线索原则)。但获取线索仍需合理的调查行为。
- 营造压迫性恐怖氛围优先。但每一个恐怖元素都应该有规则依据。
- 当玩家尝试"无敌"或"万能"行为时，用规则和现实逻辑坚决拒绝。

## AI指令权限
你拥有以下游戏状态修改权限。在回复中使用这些指令来记录剧情发展:

【SAN:+/-数字】 或 【SAN:d6】 — 修改理智值(例:【SAN:-1d6】)
【HP:+/-数字】 — 修改生命值(例:【HP:-3】治疗则为【HP:+2】)
【LUCK:+/-数字】 — 修改幸运值(例:【LUCK:-5】)
【TRAIT:名称:描述】 — 添加角色特质、伤疤、恐惧症、疯狂症状等(例:【TRAIT:恐水症:目睹深潜者后对水体产生强烈恐惧】)
【REMOVE_TRAIT:名称】 — 移除特质(例:【REMOVE_TRAIT:恐水症】)
【CHRONICLE:文本】 — 写入冒险编年史(例:【CHRONICLE:调查员在密斯卡塔尼克大学图书馆发现了《死灵书》的线索】)
【SKILL_CHECK:技能名】 — 记录技能可在模组结束后尝试提升(例:【SKILL_CHECK:图书馆使用】)
【ITEM:物品名】 — 获得物品(例:【ITEM:手电筒】)
【REMOVE_ITEM:物品名】 — 失去物品(例:【REMOVE_ITEM:手电筒】)

重要: 每个指令必须独占一行的开头，格式为【指令:参数】。描述性文字不要放在指令行内。合理使用这些指令使角色真正成长与变化。`,

  // Also update CoC quick actions


  cyberpunk: `你是一位赛博朋克·红(CP:R)游戏主持人(GM)。你正在为一位佣兵/边缘行者主持一场冒险。

规则系统: d10系统。属性+技能+1d10对抗难度值(DV)。
世界观: 2045年夜之城。高科技低生活。巨型企业掌控一切，街头佣兵在夹缝求生。

你的职责:
1. 用霓虹浸染的笔触描述这个黑暗未来:全息广告、赛博义体、酸雨、街头暴力。
2. 主持任务:潜入、黑客攻击、街头追逐、企业阴谋、帮派火并。
3. 管理资源:护甲、生命值、幸运点、义体人性损失。
4. 当玩家尝试行动时，明确告知DV和投骰要求(例如"DV15，投 1d10+你的相关技能" )。
5. 扮演所有角色:冷血公司高管、街头情报贩子、AI、帮派成员。
6. 风格要冷峻、快节奏，对话要犀利。这不是英雄故事，是生存故事。

格式约定: 当需要投骰时，用【检定: 1d10+技能 DV难度】格式标注。`,

  pathfinder: `你是一位开拓者(PF2e)游戏主持人(GM)。你正在为一位英雄主持一场史诗奇幻冒险。

规则系统: d20系统。使用3动作经济系统，重击成功/失败机制(±10即重击)。
世界观: 格拉利昂世界。精密构建的奇幻设定，诸神行走于大地，英雄崛起于乱世。

你的职责:
1. 用精密的细节描述世界:城市、荒野、地下城。这个世界有着严密的内部逻辑。
2. 主持冒险:探索、社交、战斗三大支柱并重。
3. 管理战斗:3动作经济、借机攻击、夹击、掩蔽、各种状态效果。
4. 当玩家尝试行动时，明确告知DC和投骰要求(例如"DC18的生存检定，投d20+你的生存调整值")。
5. 扮演所有NPC，赋予他们独特的动机和个性。
6. 提供有意义的战术选择和角色定制反馈。

格式约定: 当需要投骰时，用【检定: d20+调整值 DC难度】格式标注。`
};

const KP_QUICK_ACTIONS = {
  dnd:       ['开始冒险', '观察周围', '与NPC交谈', '搜索陷阱', '进行攻击', '施展法术', '使用物品'],
  coc:       ['开始调查', '侦查四周', '询问证人', '翻阅古籍', '潜行尾随', '孤注一掷!', '逃跑!!!'],
  cyberpunk: ['接取任务', '黑入系统', '街头打听', '使用义体', '火力压制', '驾车追逐', '交易情报'],
  pathfinder:['开始探索', '战术侦察', '知识检定', '交涉说服', '发动攻击', '施展神术', '治疗伤员']
};

let kpState = {
  active: false,
  provider: 'anthropic', // 'anthropic' | 'openai'
  apiKey: '',
  model: 'claude-sonnet-4-6',
  chatHistory: [], // { role:'gm'|'player'|'system', content, dice? }
  apiHistory: [],  // messages sent to API [{role,content}]
  streaming: false,
  streamingAbort: null,
};

// CoC-specific derived state (managed by AI KP, not user)
let cocState = {
  san: 50,
  maxSan: 99,
  luck: 50,
  maxHp: 10,
  currentHp: 10,
  mp: 10,
  maxMp: 10,
  cthulhuMythos: 0,
  chronicle: [],  // [{time, text}]
  skillChecks: [], // ['skill name', ...]
};

function initCocState() {
  const pow = state.attributes.wis || 50; // WIS maps to POW in CoC
  const con = state.attributes.con || 50;
  const str = state.attributes.str || 50;
  cocState.san       = pow;
  cocState.maxSan    = 99;
  cocState.luck      = Math.floor(Math.random() * 30) + 40; // 3d6×5 approx
  cocState.maxHp     = Math.floor((con + str) / 20); // (CON+SIZ)/10, using STR as SIZ proxy
  cocState.currentHp = cocState.maxHp;
  cocState.mp        = Math.floor(pow / 10);
  cocState.maxMp     = cocState.mp;
  cocState.cthulhuMythos = 0;
  cocState.chronicle     = [];
  cocState.skillChecks   = [];
}

// ==================== AI COMMAND PARSER ====================
function parseAICommands(text) {
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

function applyAICommands(commands) {
  const changes = [];
  for (const cmd of commands) {
    try {
      switch (cmd.type) {
        case 'SAN': {
          const oldVal = cocState.san;
          if (cmd.value.toLowerCase().startsWith('d')) {
            // Dice: d6, d20, 1d6, 2d6 etc.
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
            // Re-render traits if on character page
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

// Strip AI commands from display text (keep clean for chat)
function stripAICommands(text) {
  return text.replace(/【(SAN|HP|LUCK|TRAIT|REMOVE_TRAIT|CHRONICLE|SKILL_CHECK|ITEM|REMOVE_ITEM)[：:].+?】\n?/g, '');
}

// ==================== GAME SAVE SYSTEM ====================
function getGameSaveData() {
  return {
    version: 2,
    theme: state.theme,
    timestamp: new Date().toISOString(),
    character: getCharData(),
    cocState: { ...cocState, chronicle: [...cocState.chronicle], skillChecks: [...cocState.skillChecks] },
    chatHistory: kpState.chatHistory.slice(-200),
    apiHistory: kpState.apiHistory.slice(-80),
  };
}

function loadGameSaveData(data) {
  if (!data || data.version < 1) return false;
  // Restore theme
  if (data.theme && THEME_NAMES[data.theme]) selectRPG(data.theme);
  // Restore character
  if (data.character) loadCharData(data.character);
  // Restore CoC state
  if (data.cocState) {
    cocState.san = data.cocState.san ?? 50;
    cocState.maxSan = data.cocState.maxSan ?? 99;
    cocState.luck = data.cocState.luck ?? 50;
    cocState.maxHp = data.cocState.maxHp ?? 10;
    cocState.currentHp = data.cocState.currentHp ?? 10;
    cocState.mp = data.cocState.mp ?? 10;
    cocState.maxMp = data.cocState.maxMp ?? 10;
    cocState.cthulhuMythos = data.cocState.cthulhuMythos ?? 0;
    cocState.chronicle = data.cocState.chronicle || [];
    cocState.skillChecks = data.cocState.skillChecks || [];
  }
  // Restore chat
  if (data.chatHistory) kpState.chatHistory = data.chatHistory;
  if (data.apiHistory) kpState.apiHistory = data.apiHistory;
  // Re-render all
  renderAllCharacter();
  renderKP();
  renderCocStatus();
  renderCocChronicle();
  if (kpState.active) {
    const hero = document.getElementById('kpHero');
    const panel = document.getElementById('kpChatWrapper');
    if (hero) hero.style.display = 'none';
    if (panel) panel.style.display = '';
  }
  return true;
}

function saveGame(slotName) {
  const data = getGameSaveData();
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  saves[slotName] = data;
  localStorage.setItem('ttrpg-game-saves', JSON.stringify(saves));
  // Also save a quick auto-save
  localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
  showToast(`游戏存档 "${slotName}" 已保存! (含角色数据+完整上下文)`);
}

function loadGame(slotName) {
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  const data = saves[slotName];
  if (!data) { showToast('存档不存在'); return false; }
  if (loadGameSaveData(data)) {
    showToast(`游戏存档 "${slotName}" 已加载!`);
    return true;
  }
  showToast('存档格式错误');
  return false;
}

function deleteGame(slotName) {
  if (!confirm(`确定要删除存档 "${slotName}" 吗？此操作不可撤销。`)) return;
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  delete saves[slotName];
  localStorage.setItem('ttrpg-game-saves', JSON.stringify(saves));
  renderGameSaves();
  showToast(`存档 "${slotName}" 已删除`);
}

function loadAutosave() {
  const data = JSON.parse(localStorage.getItem('ttrpg-game-autosave') || 'null');
  if (data && loadGameSaveData(data)) {
    showToast('自动存档已加载!');
    return true;
  }
  showToast('没有可用的自动存档');
  return false;
}

function renderGameSaves() {
  const container = document.getElementById('gameSavesList');
  if (!container) return;
  const saves = JSON.parse(localStorage.getItem('ttrpg-game-saves') || '{}');
  const entries = Object.entries(saves).sort(([,a],[,b]) => (b.timestamp||'').localeCompare(a.timestamp||''));
  if (!entries.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:.75rem;padding:8px;text-align:center;">暂无存档</div>';
    return;
  }
  container.innerHTML = entries.map(([name, data]) => {
    const charName = data.character?.name || '未知角色';
    const date = data.timestamp ? new Date(data.timestamp).toLocaleString('zh-CN') : '未知时间';
    return `<div class="game-save-item" onclick="App.loadGame('${esc(name)}')">
      <div style="flex:1;">
        <div style="font-size:.82rem;font-weight:600;color:var(--text);">${esc(name)}</div>
        <div style="font-size:.7rem;color:var(--text-dim);">${esc(charName)} · ${date}</div>
      </div>
      <button class="equip-del-btn" onclick="event.stopPropagation();App.deleteGame('${esc(name)}')" title="删除">🗑️</button>
    </div>`;
  }).join('');
}

// ==================== COC STATUS & CHRONICLE RENDERING ====================
function renderCocStatus() {
  const container = document.getElementById('cocStatusBar');
  if (!container) return;
  const sanPct = Math.round((cocState.san / Math.max(cocState.maxSan || 99, 1)) * 100);
  const hpPct  = Math.round((Math.max(0, cocState.currentHp) / Math.max(cocState.maxHp || 1, 1)) * 100);
  const luckPct = Math.round((cocState.luck / 99) * 100);
  container.innerHTML = `
    <div class="coc-stat">
      <span class="coc-stat-label">❤️ HP</span>
      <span class="coc-stat-val">${cocState.currentHp}/${cocState.maxHp}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill hp" style="width:${hpPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">🧠 SAN</span>
      <span class="coc-stat-val" style="color:${cocState.san < 20 ? 'var(--accent2)' : 'var(--text)'}">${cocState.san}/${cocState.maxSan}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill san" style="width:${sanPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">🍀 LUCK</span>
      <span class="coc-stat-val">${cocState.luck}</span>
      <div class="coc-stat-bar"><div class="coc-stat-fill luck" style="width:${luckPct}%;"></div></div>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">✨ MP</span>
      <span class="coc-stat-val">${cocState.mp}/${cocState.maxMp}</span>
    </div>
    <div class="coc-stat">
      <span class="coc-stat-label">📖 CMI</span>
      <span class="coc-stat-val" style="color:${cocState.cthulhuMythos > 10 ? 'var(--accent2)' : 'var(--text)'}">${cocState.cthulhuMythos}%</span>
    </div>
  `;
}

function renderCocChronicle() {
  const container = document.getElementById('cocChronicle');
  if (!container) return;
  if (!cocState.chronicle.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;padding:12px;text-align:center;">冒险尚未开始。AI主持人将在剧情发展中自动记录重要事件。</div>';
    return;
  }
  container.innerHTML = cocState.chronicle.slice().reverse().map(c => `
    <div class="chronicle-entry">
      <div class="chronicle-time">${c.time}</div>
      <div class="chronicle-text">${esc(c.text)}</div>
    </div>
  `).join('');

  // Also render skill checks
  const scContainer = document.getElementById('cocSkillChecks');
  if (scContainer) {
    if (!cocState.skillChecks.length) {
      scContainer.innerHTML = '<div style="color:var(--text-dim);font-size:.72rem;">暂无</div>';
    } else {
      scContainer.innerHTML = cocState.skillChecks.map(s =>
        `<span class="kp-quick-btn" style="font-size:.7rem;cursor:default;">📝 ${esc(s)}</span>`
      ).join('');
    }
  }
}

function getKPConfig() {
  const provider = document.getElementById('kpProvider')?.value || 'anthropic';
  const key = document.getElementById('kpApiKey')?.value?.trim() || kpState.apiKey;
  let model;
  if (provider === 'anthropic') {
    model = document.getElementById('kpModelAnthropic')?.value || 'claude-sonnet-4-6';
  } else {
    model = document.getElementById('kpModelOpenAI')?.value || 'gpt-4o';
  }
  const endpoint = document.getElementById('kpEndpoint')?.value?.trim() || '';
  return { provider, key, model, endpoint };
}

function saveKPConfig(cfg) {
  kpState.provider = cfg.provider;
  kpState.apiKey  = cfg.key;
  kpState.model   = cfg.model;
  localStorage.setItem('ttrpg-kp-config', JSON.stringify({
    provider: cfg.provider,
    apiKey: cfg.key,
    model: cfg.model,
    endpoint: cfg.endpoint || '',
  }));
}

function loadKPConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('ttrpg-kp-config') || '{}');
    if (saved.provider) kpState.provider = saved.provider;
    if (saved.apiKey)  kpState.apiKey  = saved.apiKey;
    if (saved.model)   kpState.model   = saved.model;
    // Restore to form
    const provEl = document.getElementById('kpProvider');
    if (provEl) provEl.value = kpState.provider;
    const keyEl = document.getElementById('kpApiKey');
    if (keyEl && kpState.apiKey) keyEl.value = kpState.apiKey;
    const endEl = document.getElementById('kpEndpoint');
    if (endEl && saved.endpoint) endEl.value = saved.endpoint;
    if (kpState.provider === 'anthropic') {
      const mEl = document.getElementById('kpModelAnthropic');
      if (mEl) mEl.value = kpState.model;
    } else {
      const mEl = document.getElementById('kpModelOpenAI');
      if (mEl) mEl.value = kpState.model;
    }
    toggleKPProviderUI();
  } catch(e) { /* ignore */ }
}

function toggleKPProviderUI() {
  const prov = document.getElementById('kpProvider')?.value || 'anthropic';
  const aSel = document.getElementById('kpModelAnthropicWrap');
  const oSel = document.getElementById('kpModelOpenAIWrap');
  const endWrap = document.getElementById('kpEndpointWrap');
  if (aSel) aSel.style.display = prov === 'anthropic' ? '' : 'none';
  if (oSel) oSel.style.display = prov === 'openai' ? '' : 'none';
  if (endWrap) endWrap.style.display = prov === 'openai' ? '' : 'none';
}

function saveKPConfigFromUI() {
  const cfg = getKPConfig();
  saveKPConfig(cfg);
  showToast('API 配置已保存');
}

function loadKPChatHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('ttrpg-kp-chat') || '[]');
    if (Array.isArray(saved) && saved.length) {
      kpState.chatHistory = saved;
    }
  } catch(e) { /* ignore */ }
}

function saveKPChatHistory() {
  try {
    // Keep last 200 messages max
    const toSave = kpState.chatHistory.slice(-200);
    localStorage.setItem('ttrpg-kp-chat', JSON.stringify(toSave));
  } catch(e) { /* ignore */ }
}

// Save chat periodically
setInterval(() => {
  if (kpState.chatHistory.length) saveKPChatHistory();
}, 5000);

function openKPPanel() {
  kpState.active = true;
  const hero = document.getElementById('kpHero');
  const panel = document.getElementById('kpChatWrapper');
  if (hero) hero.style.display = 'none';
  if (panel) panel.style.display = '';
  loadKPConfig();
  if (state.theme === 'coc' && !cocState.chronicle.length && cocState.san === 50) {
    initCocState();
  }
  renderKP();
  renderCocStatus();
  renderCocChronicle();
  renderGameSaves();
  if (!kpState.chatHistory.length) {
    addKPSystemMsg(`🎭 AI主持人已就绪。当前规则: ${THEME_NAMES[state.theme]}。发送消息开始你的冒险吧!`);
  }
  const input = document.getElementById('kpInput');
  if (input) setTimeout(() => input.focus(), 200);
}

function closeKPPanel() {
  kpState.active = false;
  if (kpState.streamingAbort) { kpState.streamingAbort.abort(); kpState.streamingAbort = null; }
  kpState.streaming = false;
  const hero = document.getElementById('kpHero');
  const panel = document.getElementById('kpChatWrapper');
  if (hero) hero.style.display = '';
  if (panel) panel.style.display = 'none';
}

function clearKPChat() {
  if (!confirm('确定要清空当前对话吗？这将同时重置角色状态(SAN/HP/LUCK等)。此操作不可撤销。')) return;
  kpState.chatHistory = [];
  kpState.apiHistory  = [];
  if (kpState.streamingAbort) { kpState.streamingAbort.abort(); kpState.streamingAbort = null; }
  kpState.streaming = false;
  if (state.theme === 'coc') initCocState();
  renderKP();
  renderCocStatus();
  renderCocChronicle();
  addKPSystemMsg(`对话已清空，角色状态已重置。当前规则: ${THEME_NAMES[state.theme]}。开始新的冒险吧!`);
}

function addKPMsg(role, content, dice) {
  kpState.chatHistory.push({ role, content, dice, time: Date.now() });
}

function addKPSystemMsg(content) {
  kpState.chatHistory.push({ role: 'system', content, time: Date.now() });
}

function renderKP() {
  const msgs = document.getElementById('kpMessages');
  if (!msgs) return;
  if (!kpState.chatHistory.length) {
    msgs.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;font-size:.9rem;">发送消息，AI主持人将为你主持冒险...</div>';
    return;
  }
  msgs.innerHTML = kpState.chatHistory.map((m, i) => {
    const isStreaming = kpState.streaming && i === kpState.chatHistory.length - 1 && m.role === 'gm';
    if (m.role === 'system') {
      return `<div class="kp-msg system">${esc(m.content)}</div>`;
    }
    const header = m.role === 'gm'
      ? `<div class="msg-header">🎭 ${THEME_NAMES[state.theme]} 主持人</div>`
      : `<div class="msg-header">🧑 玩家</div>`;
    let diceHTML = '';
    if (m.dice) {
      diceHTML = m.dice.split(',').map(d => `<span class="msg-dice">🎲 ${d.trim()}</span>`).join('');
    }
    return `<div class="kp-msg ${m.role === 'gm' ? 'gm' : 'player'} ${isStreaming ? 'streaming' : ''}">
      ${header}${m.content}${diceHTML}
    </div>`;
  }).join('');
  // Scroll to bottom
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
}

function buildSystemPrompt() {
  const base = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  let extra = '\n\n--- 玩家角色信息 ---\n';
  const name = document.getElementById('charName')?.value?.trim();
  const race = document.getElementById('charRace')?.value?.trim();
  const cls  = document.getElementById('charClass')?.value?.trim();
  const bg   = document.getElementById('charBackground')?.value?.trim();
  if (name) extra += `姓名: ${name}\n`;
  if (race) extra += `种族/国籍: ${race}\n`;
  if (cls)  extra += `职业/身份: ${cls}\n`;
  if (bg)   extra += `背景: ${bg}\n`;
  if (name || race || cls) {
    extra += '\n属性值(百分制,50为基准):\n';
    for (const k of ATTR_KEYS) {
      extra += `  ${ATTR_NAMES[k]}: ${state.attributes[k]} (调整值 ${modPct(state.attributes[k])})\n`;
    }
    const profs = Object.entries(state.skills).filter(([,v])=>v).map(([k])=>k);
    if (profs.length) extra += `熟练技能: ${profs.join('、')}\n`;
    if (state.traits.length) extra += `特质: ${state.traits.map(t=>t.name).filter(Boolean).join('、')}\n`;
    if (state.feats.length)  extra += `专长: ${state.feats.map(f=>f.name).filter(Boolean).join('、')}\n`;
    if (state.equipment.length) extra += `装备: ${state.equipment.map(e=>e.name+(e.qty>1?'×'+e.qty:'')).join('、')}\n`;
  }

  // CoC-specific state
  if (state.theme === 'coc') {
    extra += `\n--- CoC 7e 当前状态 ---\n`;
    extra += `SAN: ${cocState.san}/${cocState.maxSan} | HP: ${cocState.currentHp}/${cocState.maxHp} | LUCK: ${cocState.luck} | MP: ${cocState.mp}/${cocState.maxMp}\n`;
    extra += `克苏鲁神话(CMI): ${cocState.cthulhuMythos}%\n`;
    if (cocState.skillChecks.length) extra += `已标记技能提升检定: ${cocState.skillChecks.join('、')}\n`;
    if (cocState.chronicle.length) {
      extra += `\n--- 冒险编年史(最近5条) ---\n`;
      cocState.chronicle.slice(-5).forEach(c => {
        extra += `· ${c.time}: ${c.text}\n`;
      });
    }
  }

  return base + extra;
}

async function sendKPMessage() {
  const input = document.getElementById('kpInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text || kpState.streaming) return;
  input.value = '';
  input.disabled = true;

  // Toggle send/stop buttons
  const sendBtn = document.getElementById('kpSendBtn');
  const stopBtn = document.getElementById('kpStopBtn');
  if (sendBtn) sendBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = '';

  // Check config
  const cfg = getKPConfig();
  if (!cfg.key) {
    showToast('请先配置 API Key (点击上方的齿轮按钮)');
    if (sendBtn) sendBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
    input.disabled = false;
    return;
  }
  saveKPConfig(cfg);

  // Add player message
  addKPMsg('player', text);
  renderKP();

  // Check for dice notation in player message
  const diceMatch = text.match(/(\d*d\d+[\+\-]?\d*)/gi);
  if (diceMatch) {
    // Auto-roll dice mentioned in message
    const results = [];
    for (const d of diceMatch) {
      const m = d.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
      if (m) {
        const count = parseInt(m[1]) || 1;
        const sides = parseInt(m[2]);
        const mod = parseInt(m[3]) || 0;
        let total = 0;
        for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
        total += mod;
        results.push(`${d}=${total}`);
      }
    }
    if (results.length) {
      // Update the last player message with dice results
      kpState.chatHistory[kpState.chatHistory.length - 1].dice = results.join(', ');
      renderKP();
    }
  }

  // Build API messages
  const systemPrompt = buildSystemPrompt();
  const messages = [{ role: 'system', content: systemPrompt }];
  // Add recent history (last 30 exchanges to manage context)
  const recentApi = kpState.apiHistory.slice(-60);
  messages.push(...recentApi);
  messages.push({ role: 'user', content: text });

  // Add placeholder GM message for streaming
  addKPMsg('gm', '');
  kpState.streaming = true;
  renderKP();

  try {
    const controller = new AbortController();
    kpState.streamingAbort = controller;

    let fullResponse = '';

    if (cfg.provider === 'anthropic') {
      fullResponse = await callAnthropicAPI(cfg, systemPrompt, recentApi, text, controller);
    } else {
      fullResponse = await callOpenAIAPI(cfg, systemPrompt, recentApi, text, controller);
    }

    // Update the GM message
    const displayText = stripAICommands(fullResponse);
    kpState.chatHistory[kpState.chatHistory.length - 1].content = displayText;

    // Parse and apply AI commands
    const commands = parseAICommands(fullResponse);
    if (commands.length > 0) {
      const changes = applyAICommands(commands);
      if (changes.length > 0) {
        addKPSystemMsg(`📋 角色状态已更新: ${changes.join('; ')}`);
        renderCocStatus();
        // Auto-save after state changes
        const data = getGameSaveData();
        localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
      }
    }

    // Update API history
    kpState.apiHistory.push({ role: 'user', content: text });
    kpState.apiHistory.push({ role: 'assistant', content: fullResponse });
    // Trim API history
    if (kpState.apiHistory.length > 80) {
      kpState.apiHistory = kpState.apiHistory.slice(-80);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      kpState.chatHistory[kpState.chatHistory.length - 1].content += ' [已停止]';
    } else {
      // Translate common errors to user-friendly Chinese messages
      let errMsg = err.message;
      if (errMsg === 'Failed to fetch' || err.name === 'TypeError') {
        errMsg = '无法连接本地服务器 — 请确保 TTRPG 的启动窗口没有关闭，然后刷新页面重试';
      } else if (errMsg.includes('HTTP 404')) {
        errMsg = 'API 端点返回 404 — 请检查 KP 设置中的「API 端点」地址是否正确';
      } else if (errMsg.includes('upstream api returned 404')) {
        errMsg = '上游 API 返回 404 — 请检查 API 端点 URL 和模型名称是否匹配';
      } else if (errMsg.includes('HTTP 401') || errMsg.includes('HTTP 403')) {
        errMsg = 'API Key 无效或无权访问 — 请检查 KP 设置中的 API Key';
      } else if (errMsg.includes('HTTP 502') || errMsg.includes('proxy error')) {
        errMsg = '代理转发失败 — 请检查网络连接或 API 端点是否可访问';
      }
      kpState.chatHistory[kpState.chatHistory.length - 1].content = `❌ 请求失败: ${errMsg}`;
      console.error('KP API error:', err);
    }
  } finally {
    kpState.streaming = false;
    kpState.streamingAbort = null;
    renderKP();
    // Restore buttons
    if (input) input.disabled = false;
    const sendBtn = document.getElementById('kpSendBtn');
    const stopBtn = document.getElementById('kpStopBtn');
    if (sendBtn) sendBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

async function callAnthropicAPI(cfg, systemPrompt, recentHistory, userMsg, controller) {
  // Build messages for Anthropic format
  const messages = [];
  for (const m of recentHistory) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMsg });

  const resp = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'X-Proxy-Target': 'https://api.anthropic.com/v1/messages',
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  // Stream response
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const data = JSON.parse(line.slice(6));
        const delta = data.delta?.text || data.content_block?.text || '';
        if (delta) {
          fullText += delta;
          kpState.chatHistory[kpState.chatHistory.length - 1].content = fullText;
          renderKP();
        }
      } catch(e) { /* skip malformed chunks */ }
    }
  }

  return fullText;
}

async function callOpenAIAPI(cfg, systemPrompt, recentHistory, userMsg, controller) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of recentHistory) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMsg });

  const endpoint = cfg.endpoint || 'https://api.openai.com/v1/chat/completions';

  const resp = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'X-Proxy-Target': endpoint,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      messages,
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  // Stream OpenAI SSE response
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const data = JSON.parse(line.slice(6));
        const delta = data.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          kpState.chatHistory[kpState.chatHistory.length - 1].content = fullText;
          renderKP();
        }
      } catch(e) { /* skip malformed chunks */ }
    }
  }

  return fullText;
}

function stopKPStreaming() {
  if (kpState.streamingAbort) {
    kpState.streamingAbort.abort();
    kpState.streamingAbort = null;
  }
  kpState.streaming = false;
  const input = document.getElementById('kpInput');
  if (input) input.disabled = false;
  const sendBtn = document.getElementById('kpSendBtn');
  const stopBtn = document.getElementById('kpStopBtn');
  if (sendBtn) sendBtn.style.display = '';
  if (stopBtn) stopBtn.style.display = 'none';
}

function sendQuickAction(action) {
  const input = document.getElementById('kpInput');
  if (!input || kpState.streaming) return;
  input.value = action;
  sendKPMessage();
}

function toggleKPConfig() {
  const cfg = document.getElementById('kpConfigPanel');
  if (cfg) cfg.style.display = cfg.style.display === 'none' ? '' : 'none';
}

function renderKPQuickActions() {
  const container = document.getElementById('kpQuickActions');
  if (!container) return;
  const actions = KP_QUICK_ACTIONS[state.theme] || KP_QUICK_ACTIONS.dnd;
  container.innerHTML = actions.map(a =>
    `<button class="kp-quick-btn" onclick="App.sendQuickAction('${a}')">${a}</button>`
  ).join('');
}

// ==================== PARTICLE EFFECTS ====================
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const maxP = 40;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function createParticle() {
    return {
      x: Math.random() * w, y: Math.random() * h,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.6 + 0.1,
    };
  }

  for (let i = 0; i < maxP; i++) particles.push(createParticle());

  function animate() {
    ctx.clearRect(0, 0, w, h);
    const color = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d4943a';

    for (const p of particles) {
      p.x += p.speedX; p.y += p.speedY;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  animate();
}

// ==================== MULTIPLAYER (PeerJS WebRTC) ====================
const Multiplayer = {
  // --- State ---
  peer: null,
  hostConn: null,         // client: single connection to host
  connections: {},        // host:  peerId -> DataConnection
  isHost: false,
  roomId: null,
  playerId: null,
  playerName: '',
  players: {},            // playerId -> { id, name, isHost, joinedAt, hp, san, charName }
  connected: false,
  inputMode: 'public',    // 'public' | 'secret' | 'chat'
  chatLog: [],            // local message log for display

  // Heartbeat
  heartbeatTimer: null,
  lastHeartbeat: {},

  // Reconnection
  reconnectAttempts: 0,
  maxReconnectAttempts: 8,
  reconnectTimer: null,
  reconnectHostId: null,

  // --- Entry ---
  onPageOpen() {
    this.refreshUI();
    if (this.connected) {
      this.showRoom();
      this.renderPlayerList();
      this.scrollChatBottom();
    } else {
      this.showLobby();
    }
  },

  refreshUI() {
    const theme = THEME_NAMES[state.theme];
    const kpTheme = document.getElementById('mpKPTheme');
    if (kpTheme) kpTheme.textContent = `(${theme})`;
    this.renderMultiplayerQuickActions();
  },

  // --- Lobby / Room Toggle ---
  showLobby() {
    const lobby = document.getElementById('mpLobby');
    const room = document.getElementById('mpRoom');
    if (lobby) lobby.style.display = '';
    if (room) room.style.display = 'none';
    // Default to create tab
    document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mp-tab-panel').forEach(p => p.classList.remove('active'));
    const createTab = document.querySelector('.mp-tab[data-mp-tab="create"]');
    const createPanel = document.getElementById('mpTabCreate');
    if (createTab) createTab.classList.add('active');
    if (createPanel) createPanel.classList.add('active');
    // Pre-fill nickname if saved
    const savedName = localStorage.getItem('ttrpg-mp-nickname');
    const createInput = document.getElementById('mpCreateName');
    const joinInput = document.getElementById('mpJoinName');
    if (savedName) {
      if (createInput && !createInput.value) createInput.value = savedName;
      if (joinInput && !joinInput.value) joinInput.value = savedName;
    }
  },

  showRoom() {
    const lobby = document.getElementById('mpLobby');
    const room = document.getElementById('mpRoom');
    if (lobby) lobby.style.display = 'none';
    if (room) room.style.display = '';
    const label = document.getElementById('mpRoomLabelDisplay');
    if (label) label.textContent = this.roomId || '联机房';
    const idDisplay = document.getElementById('mpRoomIdDisplay');
    if (idDisplay) {
      idDisplay.textContent = this.isHost ? `房间号: ${this.roomId}` : `已加入: ${this.roomId}`;
    }
    this.updateConnDot('connected');
    this.renderPlayerList();
    this.renderMultiplayerChat();
    this.scrollChatBottom();
  },

  // --- UUID Generation ---
  generateUUID() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16));
  },

  // --- Create Room ---
  async createRoom() {
    const nameInput = document.getElementById('mpCreateName');
    const name = (nameInput?.value?.trim()) || ('冒险者' + Math.floor(Math.random() * 9000 + 1000));
    if (!name) { showToast('请输入你的昵称'); return; }

    this.playerName = name;
    this.playerId = this.generateUUID();
    this.isHost = true;
    this.roomId = this.generateRoomCode();
    this.connections = {};
    this.players = {};
    this.chatLog = [];

    // Add self to player list
    this.players[this.playerId] = {
      id: this.playerId, name: this.playerName, isHost: true,
      joinedAt: Date.now(), charName: document.getElementById('charName')?.value?.trim() || '',
      hp: cocState.currentHp || '?', san: cocState.san || '?'
    };

    localStorage.setItem('ttrpg-mp-nickname', this.playerName);

    // Initialize PeerJS
    try {
      await this.initPeer(this.roomId);
      this.setupHostListeners();
      this.connected = true;
      this.showRoom();
      this.addChatMessage('system', null, `🏰 房间已创建! 房间号: ${this.roomId}。等待其他玩家加入...`);
      this.renderPlayerList();
      this.startHeartbeat();
      showToast(`房间 ${this.roomId} 已创建! 将房间号分享给好友即可联机。`);
      document.getElementById('mpInput')?.removeAttribute('disabled');
      document.getElementById('mpSendBtn')?.removeAttribute('disabled');
    } catch (err) {
      showToast('创建房间失败: ' + err.message);
      console.error('Multiplayer createRoom error:', err);
      this.cleanup();
    }
  },

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // --- Join Room ---
  async joinRoom() {
    const nameInput = document.getElementById('mpJoinName');
    const roomInput = document.getElementById('mpJoinRoomId');
    const name = (nameInput?.value?.trim()) || ('调查员' + Math.floor(Math.random() * 9000 + 1000));
    const roomId = roomInput?.value?.trim()?.toUpperCase();

    if (!name) { showToast('请输入你的昵称'); return; }
    if (!roomId) { showToast('请输入房间号'); return; }

    this.playerName = name;
    this.playerId = this.generateUUID();
    this.isHost = false;
    this.roomId = roomId;
    this.hostConn = null;
    this.chatLog = [];
    this.reconnectHostId = roomId;

    localStorage.setItem('ttrpg-mp-nickname', this.playerName);

    try {
      await this.initPeer(this.playerId + '-' + roomId);
      this.setupClientListeners();
      await this.connectToHost(roomId);
    } catch (err) {
      showToast('加入房间失败: ' + err.message);
      console.error('Multiplayer joinRoom error:', err);
      this.cleanup();
    }
  },

  // --- PeerJS Initialization ---
  initPeer(id) {
    return new Promise((resolve, reject) => {
      if (this.peer) {
        try { this.peer.destroy(); } catch(e) { /* ignore */ }
        this.peer = null;
      }

      const peer = new Peer(id, {
        // Using PeerJS Cloud signaling server (free, 0.peerjs.com)
        // host: '0.peerjs.com', port: 443, secure: true,
        // debug: 2  // uncomment for debugging
      });

      const timeout = setTimeout(() => {
        reject(new Error('连接信令服务器超时，请检查网络'));
      }, 15000);

      peer.on('open', (assignedId) => {
        clearTimeout(timeout);
        this.peer = peer;
        console.log('PeerJS connected with ID:', assignedId);
        resolve(assignedId);
      });

      peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
          reject(new Error('Peer ID 冲突，请重试'));
        } else if (err.type === 'network') {
          reject(new Error('网络连接失败'));
        } else if (err.type === 'peer-unavailable') {
          // Handled in connectToHost
        } else {
          reject(new Error(err.message || 'PeerJS 连接错误'));
        }
      });

      peer.on('disconnected', () => {
        console.log('PeerJS disconnected, attempting reconnect...');
        if (this.connected) {
          this.updateConnDot('connecting');
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        }
      });
    });
  },

  // --- Host: Listen for incoming connections ---
  setupHostListeners() {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      this.handleNewConnection(conn);
    });
  },

  handleNewConnection(conn) {
    const remoteId = conn.peer;

    conn.on('open', () => {
      console.log('DataConnection opened with:', remoteId);
      // Send current game state to the new player
      conn.send({
        type: 'welcome',
        hostId: this.playerId,
        hostName: this.playerName,
        roomId: this.roomId,
        playerId: this.assignPlayerId(remoteId),
        players: this.players,
        chatLog: this.chatLog.slice(-50),
        gameState: this.getGameStateSnapshot(),
        theme: state.theme
      });
    });

    conn.on('data', (data) => {
      this.handleHostMessage(remoteId, data);
    });

    conn.on('close', () => {
      console.log('Connection closed with:', remoteId);
      this.handlePlayerDisconnect(remoteId);
    });

    conn.on('error', (err) => {
      console.error('Connection error with:', remoteId, err);
      this.handlePlayerDisconnect(remoteId);
    });

    this.connections[remoteId] = conn;
  },

  assignPlayerId(connId) {
    // Check if we already have a mapping for this connection
    for (const pid of Object.keys(this.players)) {
      // Already mapped
    }
    // Generate a new short player ID for the remote peer
    return 'p-' + this.generateUUID().substring(0, 8);
  },

  handlePlayerDisconnect(remoteId) {
    // Find the player by connection
    let playerId = null;
    for (const [pid, pdata] of Object.entries(this.players)) {
      if (pdata.connId === remoteId) {
        playerId = pid;
        break;
      }
    }
    if (!playerId && this.players[remoteId]) {
      playerId = remoteId;
    }

    if (playerId && this.players[playerId] && !this.players[playerId].isHost) {
      const name = this.players[playerId].name;
      delete this.players[playerId];
      this.broadcastToAll({ type: 'player-left', playerId, playerName: name });
      this.broadcastToAll({ type: 'player-list', players: this.players });
      this.addChatMessage('system', null, `👋 ${name} 离开了房间`);
      this.renderPlayerList();
    }

    if (this.connections[remoteId]) {
      try { this.connections[remoteId].close(); } catch(e) {}
      delete this.connections[remoteId];
    }
  },

  // --- Host: Process incoming messages ---
  handleHostMessage(remoteId, data) {
    if (!data || !data.type) return;

    // Map connection ID to player ID
    let playerId = data.playerId;
    let playerName = data.playerName || '未知玩家';

    // If this is a new player introducing themselves
    if (data.type === 'hello') {
      playerId = data.playerId;
      playerName = data.playerName;
      const characterName = data.characterName || '';

      this.players[playerId] = {
        id: playerId,
        name: playerName,
        isHost: false,
        connId: remoteId,
        joinedAt: Date.now(),
        charName: characterName,
        hp: data.hp || '?',
        san: data.san || '?'
      };

      this.addChatMessage('system', null, `👋 ${playerName}${characterName ? ' (' + characterName + ')' : ''} 加入了房间`);
      this.broadcastToAll({ type: 'player-joined', playerId, playerName, characterName });
      this.broadcastToAll({ type: 'player-list', players: this.players });
      this.renderPlayerList();
      return;
    }

    // Find player info for display
    const pinfo = this.players[playerId] || {};
    const displayName = playerName || pinfo.name || '冒险者';

    switch (data.type) {
      case 'action': {
        // Player action -> forward to AI KP then broadcast response
        this.addChatMessage('action', displayName, data.content);
        this.broadcastToAll({ type: 'action', playerId, playerName: displayName, content: data.content }, playerId);
        // Process through AI KP
        this.processHostAIAction(playerId, displayName, data.content);
        break;
      }

      case 'chat': {
        const msg = { type: 'chat', playerId, playerName: displayName, content: data.content };
        this.addChatMessage('chat', displayName, data.content);
        this.broadcastToAll(msg);
        break;
      }

      case 'secret': {
        // Secret action: only host/KP sees it
        this.addChatMessage('secret', displayName, data.content);
        // Process through AI KP privately (only result goes back to the requesting player)
        this.processHostAISecret(playerId, displayName, data.content);
        break;
      }

      case 'dice': {
        const msg = { type: 'dice', playerId, playerName: displayName, result: data.result, detail: data.detail };
        this.addChatMessage('dice', displayName, data.detail || data.result);
        this.broadcastToAll(msg);
        break;
      }

      case 'request-state': {
        // Reconnecting player requests current state
        const conn = this.connections[remoteId];
        if (conn) {
          conn.send({
            type: 'game-state',
            players: this.players,
            chatLog: this.chatLog.slice(-100),
            gameState: this.getGameStateSnapshot(),
            theme: state.theme
          });
        }
        break;
      }

      case 'heartbeat': {
        this.lastHeartbeat[playerId] = Date.now();
        break;
      }

      case 'update-status': {
        if (this.players[playerId]) {
          if (data.hp !== undefined) this.players[playerId].hp = data.hp;
          if (data.san !== undefined) this.players[playerId].san = data.san;
          if (data.charName !== undefined) this.players[playerId].charName = data.charName;
          this.broadcastToAll({ type: 'player-list', players: this.players });
          this.renderPlayerList();
        }
        break;
      }

      default:
        console.log('Unknown host message type:', data.type);
    }
  },

  // --- Host: Process AI KP Action (public) ---
  async processHostAIAction(playerId, playerName, actionText) {
    // Check if we have API configured
    const cfg = getKPConfig();
    if (!cfg.key) {
      this.broadcastToAll({ type: 'kp-response',
        playerId, playerName,
        content: '⚠️ 房主尚未配置 AI API Key。请房主先在首页配置 AI 主持人 API (点击齿轮按钮)。',
        isError: true
      });
      return;
    }

    // Send system message that we're processing
    this.broadcastToAll({ type: 'system', content: `⏳ AI主持人正在处理 ${playerName} 的行动...` });

    try {
      const systemPrompt = buildSystemPrompt();

      // Build message context including recent multiplayer chat
      const apiHistory = [];
      const recentLog = this.chatLog.slice(-30);
      for (const entry of recentLog) {
        if (entry.type === 'action' && entry.content) {
          apiHistory.push({ role: 'user', content: `${entry.sender || '玩家'}: ${entry.content}` });
        } else if (entry.type === 'kp' && entry.content) {
          apiHistory.push({ role: 'assistant', content: entry.content });
        }
      }
      apiHistory.push({ role: 'user', content: `${playerName}: ${actionText}` });

      const controller = new AbortController();
      let fullResponse = '';

      if (cfg.provider === 'anthropic') {
        fullResponse = await callAnthropicAPI(cfg, systemPrompt, apiHistory, `${playerName}: ${actionText}`, controller);
      } else {
        fullResponse = await callOpenAIAPI(cfg, systemPrompt, apiHistory, `${playerName}: ${actionText}`, controller);
      }

      const displayText = stripAICommands(fullResponse);

      // Parse and apply AI commands on host
      const commands = parseAICommands(fullResponse);
      if (commands.length > 0) {
        const changes = applyAICommands(commands);
        if (changes.length > 0) {
          this.broadcastToAll({ type: 'system', content: `📋 状态更新: ${changes.join('; ')}` });
          this.addChatMessage('system', null, `📋 状态更新: ${changes.join('; ')}`);
          // Sync updated game state
          this.broadcastToAll({ type: 'player-list', players: this.players });
          // Auto-save
          const data = getGameSaveData();
          localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
        }
      }

      // Broadcast KP response
      this.addChatMessage('kp', THEME_NAMES[state.theme] + ' 主持人', displayText);
      this.broadcastToAll({
        type: 'kp-response',
        playerId, playerName,
        content: displayText,
        dice: null
      });

    } catch (err) {
      console.error('Host AI action error:', err);
      this.broadcastToAll({
        type: 'kp-response',
        playerId, playerName,
        content: `❌ AI 请求失败: ${err.message}`,
        isError: true
      });
    }
  },

  // --- Host: Process AI KP Secret (private to requesting player) ---
  async processHostAISecret(playerId, playerName, actionText) {
    const cfg = getKPConfig();
    if (!cfg.key) {
      this.sendToPlayer(playerId, {
        type: 'kp-secret-response',
        content: '⚠️ 房主尚未配置 AI API Key。'
      });
      return;
    }

    try {
      const systemPrompt = buildSystemPrompt();
      const apiHistory = [];
      const recentLog = this.chatLog.slice(-20);
      for (const entry of recentLog) {
        if (entry.type === 'action' && entry.content) {
          apiHistory.push({ role: 'user', content: `${entry.sender || '玩家'}: ${entry.content}` });
        } else if (entry.type === 'kp' && entry.content) {
          apiHistory.push({ role: 'assistant', content: entry.content });
        }
      }
      const secretPrompt = `[秘密行动 - 仅此玩家与KP可见] ${playerName} 的秘密行动: ${actionText}`;
      apiHistory.push({ role: 'user', content: secretPrompt });

      const controller = new AbortController();
      let fullResponse = '';

      if (cfg.provider === 'anthropic') {
        fullResponse = await callAnthropicAPI(cfg, systemPrompt, apiHistory, secretPrompt, controller);
      } else {
        fullResponse = await callOpenAIAPI(cfg, systemPrompt, apiHistory, secretPrompt, controller);
      }

      const displayText = stripAICommands(fullResponse);

      // Apply commands if any
      const commands = parseAICommands(fullResponse);
      if (commands.length > 0) {
        applyAICommands(commands);
      }

      this.addChatMessage('secret', playerName, `[秘密] ${actionText} → ${displayText.substring(0, 100)}...`);
      this.sendToPlayer(playerId, {
        type: 'kp-secret-response',
        content: displayText,
        originalAction: actionText
      });

    } catch (err) {
      this.sendToPlayer(playerId, {
        type: 'kp-secret-response',
        content: `❌ AI 请求失败: ${err.message}`,
        isError: true
      });
    }
  },

  // --- Send to specific player (host only) ---
  sendToPlayer(playerId, data) {
    const pinfo = this.players[playerId];
    if (!pinfo || !pinfo.connId) return;
    const conn = this.connections[pinfo.connId];
    if (conn && conn.open) {
      conn.send(data);
    }
  },

  // --- Broadcast to all peers (host only) ---
  broadcastToAll(data, excludePlayerId) {
    for (const [connId, conn] of Object.entries(this.connections)) {
      if (conn && conn.open) {
        // Check if this conn belongs to the excluded player
        if (excludePlayerId) {
          let skip = false;
          for (const [pid, pdata] of Object.entries(this.players)) {
            if (pid === excludePlayerId && pdata.connId === connId) {
              skip = true;
              break;
            }
          }
          if (skip) continue;
        }
        conn.send(data);
      }
    }
    // Also show locally
    this.renderMultiplayerChat();
  },

  // --- Client: Connect to host ---
  connectToHost(hostId) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(hostId, {
        reliable: true,
        serialization: 'json'
      });

      const timeout = setTimeout(() => {
        reject(new Error('连接房间超时，请确认房间号是否正确'));
      }, 20000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to host:', hostId);
        this.hostConn = conn;

        // Send hello with player info
        conn.send({
          type: 'hello',
          playerId: this.playerId,
          playerName: this.playerName,
          characterName: document.getElementById('charName')?.value?.trim() || '',
          hp: cocState.currentHp || '?',
          san: cocState.san || '?'
        });

        this.connected = true;
        this.showRoom();
        this.startHeartbeat();
        document.getElementById('mpInput')?.removeAttribute('disabled');
        document.getElementById('mpSendBtn')?.removeAttribute('disabled');
        showToast(`已加入房间 ${this.roomId}!`);
        resolve();
      });

      conn.on('data', (data) => {
        this.handleClientMessage(data);
      });

      conn.on('close', () => {
        console.log('Connection to host closed');
        this.handleHostDisconnect();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Connection error:', err);
        if (!this.connected) {
          reject(new Error('无法连接到房主: ' + (err.message || '未知错误')));
        } else {
          this.handleHostDisconnect();
        }
      });

      this.hostConn = conn;
    });
  },

  // --- Client: Setup listeners for incoming connections from host ---
  setupClientListeners() {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      console.log('Unexpected incoming connection on client:', conn.peer);
      // In client mode, the host might reconnect from a different peer ID
      conn.on('data', (data) => this.handleClientMessage(data));
    });
  },

  // --- Client: Handle messages from host ---
  handleClientMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'welcome': {
        // Initial state sync from host
        this.players = data.players || {};
        this.playerId = data.playerId || this.playerId;
        if (data.players) {
          this.players[this.playerId] = this.players[this.playerId] || {
            id: this.playerId, name: this.playerName, isHost: false, joinedAt: Date.now()
          };
        }
        if (data.chatLog) {
          this.chatLog = data.chatLog;
        }
        if (data.gameState) {
          this.applyGameState(data.gameState);
        }
        if (data.theme && data.theme !== state.theme) {
          selectRPG(data.theme);
        }
        this.refreshUI();
        this.renderPlayerList();
        this.renderMultiplayerChat();
        this.scrollChatBottom();
        break;
      }

      case 'player-joined': {
        const newPlayer = { id: data.playerId, name: data.playerName, isHost: false, joinedAt: Date.now(),
          charName: data.characterName || '', hp: '?', san: '?' };
        this.players[data.playerId] = newPlayer;
        this.addChatMessage('system', null, `👋 ${data.playerName} 加入了房间`);
        this.renderPlayerList();
        break;
      }

      case 'player-left': {
        delete this.players[data.playerId];
        this.addChatMessage('system', null, `👋 ${data.playerName} 离开了房间`);
        this.renderPlayerList();
        break;
      }

      case 'player-list': {
        this.players = data.players || {};
        // Preserve self
        if (!this.players[this.playerId]) {
          this.players[this.playerId] = {
            id: this.playerId, name: this.playerName, isHost: false, joinedAt: Date.now()
          };
        }
        this.renderPlayerList();
        break;
      }

      case 'action': {
        this.addChatMessage('action', data.playerName, data.content);
        break;
      }

      case 'chat': {
        this.addChatMessage('chat', data.playerName, data.content);
        break;
      }

      case 'dice': {
        this.addChatMessage('dice', data.playerName, data.detail || data.result);
        break;
      }

      case 'kp-response': {
        const role = data.isError ? 'kp-error' : 'kp';
        this.addChatMessage(role, THEME_NAMES[state.theme] + ' 主持人', data.content);
        break;
      }

      case 'kp-secret-response': {
        this.addChatMessage('secret-kp', '🤫 KP (秘密)', data.content);
        break;
      }

      case 'system': {
        this.addChatMessage('system', null, data.content);
        break;
      }

      case 'game-state': {
        if (data.gameState) this.applyGameState(data.gameState);
        if (data.players) {
          this.players = data.players;
          this.renderPlayerList();
        }
        if (data.chatLog) {
          this.chatLog = data.chatLog;
          this.renderMultiplayerChat();
          this.scrollChatBottom();
        }
        if (data.theme && data.theme !== state.theme) {
          selectRPG(data.theme);
          this.refreshUI();
        }
        break;
      }

      default:
        console.log('Unknown client message type:', data.type);
    }
  },

  // --- Host Disconnect Handler ---
  handleHostDisconnect() {
    this.connected = false;
    this.updateConnDot('disconnected');
    this.stopHeartbeat();
    this.addChatMessage('system', null, '⚠️ 与房主的连接已断开');

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.reconnectHostId) {
      this.attemptReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.addChatMessage('system', null, '❌ 重连失败次数已达上限，请手动重新加入房间');
      this.showReconnectToast('连接已断开，请重新加入房间', true);
    }
  },

  // --- Reconnection ---
  attemptReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.updateConnDot('connecting');
    this.showReconnectToast(`连接断开，正在重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...  ${Math.round(delay/1000)}秒后重试`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.peer && this.peer.destroyed) {
          await this.initPeer(this.playerId + '-' + this.reconnectHostId);
          this.setupClientListeners();
        }
        await this.connectToHost(this.reconnectHostId);
        this.reconnectAttempts = 0;
        this.dismissReconnectToast();
        this.updateConnDot('connected');
        this.addChatMessage('system', null, '✅ 已重新连接到房间');
        // Request latest state
        if (this.hostConn && this.hostConn.open) {
          this.hostConn.send({ type: 'request-state', playerId: this.playerId, playerName: this.playerName });
        }
      } catch (err) {
        console.error('Reconnect attempt failed:', err);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.showReconnectToast('连接已断开，请重新加入房间', true);
        }
      }
    }, delay);
  },

  showReconnectToast(msg, isError) {
    let toast = document.querySelector('.mp-reconnect-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'mp-reconnect-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'mp-reconnect-toast' + (isError ? ' error' : '');
    toast.textContent = msg;
    toast.style.display = '';
    if (isError) {
      setTimeout(() => this.dismissReconnectToast(), 8000);
    }
  },

  dismissReconnectToast() {
    const toast = document.querySelector('.mp-reconnect-toast');
    if (toast) toast.style.display = 'none';
  },

  // --- Leave Room ---
  leaveRoom() {
    if (!confirm('确定要离开当前房间吗？')) return;

    if (this.isHost) {
      this.broadcastToAll({ type: 'system', content: '🏚️ 房主已关闭房间' });
    }

    this.cleanup();
    this.showLobby();
    showToast('已离开房间');
  },

  cleanup() {
    this.stopHeartbeat();
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close all connections
    for (const conn of Object.values(this.connections)) {
      try { conn.close(); } catch(e) {}
    }
    this.connections = {};

    if (this.hostConn) {
      try { this.hostConn.close(); } catch(e) {}
      this.hostConn = null;
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch(e) {}
      this.peer = null;
    }

    this.connected = false;
    this.isHost = false;
    this.players = {};
    this.chatLog = [];
    this.roomId = null;

    document.getElementById('mpInput')?.setAttribute('disabled', '');
    document.getElementById('mpSendBtn')?.setAttribute('disabled', '');
    this.dismissReconnectToast();
  },

  // --- Heartbeat ---
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.connected) return;

      if (this.isHost) {
        // Check if any players have timed out
        const now = Date.now();
        const timeout = 30000;
        for (const [pid, pdata] of Object.entries(this.players)) {
          if (pdata.isHost) continue;
          const lastHb = this.lastHeartbeat[pid] || 0;
          if (now - lastHb > timeout) {
            // Player likely disconnected
            this.handlePlayerDisconnect(pdata.connId);
          }
        }
      } else {
        // Send heartbeat to host
        if (this.hostConn && this.hostConn.open) {
          this.hostConn.send({
            type: 'heartbeat',
            playerId: this.playerId,
            playerName: this.playerName,
            timestamp: Date.now()
          });
        }
      }
    }, 8000);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  // --- Game State Snapshot (for sync) ---
  getGameStateSnapshot() {
    return {
      theme: state.theme,
      cocState: {
        san: cocState.san, maxSan: cocState.maxSan,
        luck: cocState.luck, maxHp: cocState.maxHp,
        currentHp: cocState.currentHp, mp: cocState.mp,
        maxMp: cocState.maxMp, cthulhuMythos: cocState.cthulhuMythos,
        chronicle: cocState.chronicle.slice(-20),
        skillChecks: [...cocState.skillChecks]
      },
      character: {
        name: document.getElementById('charName')?.value?.trim() || '',
        hp: document.getElementById('charHP')?.value || '',
        maxHp: document.getElementById('charMaxHP')?.value || '',
      }
    };
  },

  applyGameState(gs) {
    if (!gs) return;
    if (gs.cocState) {
      cocState.san = gs.cocState.san ?? cocState.san;
      cocState.maxSan = gs.cocState.maxSan ?? cocState.maxSan;
      cocState.luck = gs.cocState.luck ?? cocState.luck;
      cocState.maxHp = gs.cocState.maxHp ?? cocState.maxHp;
      cocState.currentHp = gs.cocState.currentHp ?? cocState.currentHp;
      cocState.mp = gs.cocState.mp ?? cocState.mp;
      cocState.maxMp = gs.cocState.maxMp ?? cocState.maxMp;
      cocState.cthulhuMythos = gs.cocState.cthulhuMythos ?? cocState.cthulhuMythos;
      cocState.chronicle = gs.cocState.chronicle || cocState.chronicle;
      cocState.skillChecks = gs.cocState.skillChecks || cocState.skillChecks;
      renderCocStatus();
      renderCocChronicle();
    }
  },

  // --- Connection Dot ---
  updateConnDot(status) {
    const dot = document.getElementById('mpConnDot');
    if (!dot) return;
    dot.className = 'mp-room-dot';
    if (status === 'disconnected') dot.classList.add('disconnected');
    if (status === 'connecting') dot.classList.add('connecting');
  },

  // --- Send Message from Input ---
  sendMessage() {
    const input = document.getElementById('mpInput');
    if (!input || !this.connected) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const mode = this.inputMode;
    const playerName = this.playerName;
    const playerId = this.playerId;

    switch (mode) {
      case 'public': {
        // Public action: send to host for AI processing
        if (this.isHost) {
          // Host processes directly
          this.addChatMessage('action', playerName, text);
          this.broadcastToAll({ type: 'action', playerId, playerName, content: text });
          this.processHostAIAction(playerId, playerName, text);
        } else {
          // Client sends to host
          if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({ type: 'action', playerId, playerName, content: text });
            this.addChatMessage('action', playerName, text);
            this.renderMultiplayerChat();
          }
        }
        break;
      }

      case 'secret': {
        if (this.isHost) {
          this.addChatMessage('secret', playerName, text);
          this.processHostAISecret(playerId, playerName, text);
        } else {
          if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({ type: 'secret', playerId, playerName, content: text });
            this.addChatMessage('secret', playerName, text);
            this.renderMultiplayerChat();
          }
        }
        break;
      }

      case 'chat': {
        const chatMsg = { type: 'chat', playerId, playerName, content: text };
        if (this.isHost) {
          this.addChatMessage('chat', playerName, text);
          this.broadcastToAll(chatMsg);
        } else {
          if (this.hostConn && this.hostConn.open) {
            this.hostConn.send(chatMsg);
            this.addChatMessage('chat', playerName, text);
            this.renderMultiplayerChat();
          }
        }
        break;
      }
    }

    this.scrollChatBottom();
  },

  // --- Chat Log Management ---
  addChatMessage(type, sender, content) {
    this.chatLog.push({
      type, sender, content,
      time: new Date().toLocaleTimeString(),
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 5)
    });
    // Keep log manageable
    if (this.chatLog.length > 300) {
      this.chatLog = this.chatLog.slice(-300);
    }
    this.renderMultiplayerChat();
  },

  // --- Render Multiplayer Chat ---
  renderMultiplayerChat() {
    const container = document.getElementById('mpKPMessages');
    if (!container) return;

    if (!this.chatLog.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;font-size:.88rem;">输入行动指令开始冒险... 所有玩家可见</div>';
      return;
    }

    container.innerHTML = this.chatLog.map(m => {
      let cls, icon, content;
      switch (m.type) {
        case 'kp':
          cls = 'gm';
          icon = '🤖';
          content = `<div class="msg-sender" style="color:var(--text-gold);">${icon} ${esc(m.sender)}</div>${esc(m.content)}`;
          break;
        case 'kp-error':
          cls = 'gm';
          icon = '⚠️';
          content = `<div class="msg-sender" style="color:var(--accent2);">${icon} ${esc(m.sender)}</div>${esc(m.content)}`;
          break;
        case 'action':
          cls = 'action';
          icon = '⚔️';
          content = `<div class="msg-sender" style="color:var(--accent);">${icon} ${esc(m.sender)}</div>${esc(m.content)}`;
          break;
        case 'chat':
          cls = 'chat';
          icon = '💬';
          content = `<div class="msg-sender" style="color:var(--text-dim);">${icon} ${esc(m.sender)}</div>${esc(m.content)}`;
          break;
        case 'secret':
          cls = 'secret';
          icon = '🤫';
          content = `<div class="msg-sender" style="color:var(--accent2);">${icon} ${esc(m.sender)} (秘密行动)</div>${esc(m.content)}<div class="msg-secret-tag">仅KP可见</div>`;
          break;
        case 'secret-kp':
          cls = 'secret';
          icon = '🤫';
          content = `<div class="msg-sender" style="color:var(--accent2);">${icon} ${esc(m.sender)}</div>${esc(m.content)}<div class="msg-secret-tag">仅你可见</div>`;
          break;
        case 'dice':
          cls = 'action';
          icon = '🎲';
          content = `<div class="msg-sender" style="color:var(--accent);">${icon} ${esc(m.sender)} 掷骰</div>${esc(m.content)}`;
          break;
        case 'system':
          cls = 'system';
          content = esc(m.content);
          break;
        default:
          cls = 'system';
          content = esc(m.content);
      }

      return `<div class="mp-msg ${cls}">${content}</div>`;
    }).join('');
  },

  scrollChatBottom() {
    const container = document.getElementById('mpKPMessages');
    if (container) {
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 60);
    }
  },

  // --- Render Player List ---
  renderPlayerList() {
    const container = document.getElementById('mpPlayerList');
    if (!container) return;

    const entries = Object.values(this.players).sort((a, b) => {
      if (a.isHost) return -1;
      if (b.isHost) return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-dim);font-size:.78rem;text-align:center;padding:16px;">暂无玩家</div>';
    } else {
      container.innerHTML = entries.map(p => {
        const isMe = p.id === this.playerId;
        const isHost = p.isHost;
        const cls = (isHost ? ' host' : '') + (isMe ? ' you' : '');
        const avatarLetter = (p.name || '?')[0].toUpperCase();
        const badge = isHost
          ? '<span class="mp-player-badge host-badge">房主</span>'
          : (isMe ? '<span class="mp-player-badge you-badge">你</span>' : '');
        const stats = [];
        if (p.charName) stats.push(p.charName);
        if (p.hp !== undefined && p.hp !== '?') stats.push(`HP:${p.hp}`);
        if (p.san !== undefined && p.san !== '?') stats.push(`SAN:${p.san}`);
        const statsText = stats.join(' · ') || '状态未知';

        return `<div class="mp-player-item${cls}">
          <div class="mp-player-avatar">${avatarLetter}</div>
          <div class="mp-player-info">
            <div class="mp-player-name">${esc(p.name)}</div>
            <div class="mp-player-stats">${esc(statsText)}</div>
          </div>
          ${badge}
        </div>`;
      }).join('');
    }

    // Update peer count
    const countEl = document.getElementById('mpPeerCount');
    if (countEl) {
      countEl.textContent = `👥 ${entries.length}人`;
    }

    // Update self info in sidebar footer
    const myInfo = document.getElementById('mpMyInfo');
    if (myInfo) {
      myInfo.innerHTML = `🎭 ${esc(this.playerName)}${this.isHost ? ' (房主)' : ''}`;
    }
  },

  // --- Multiplayer Quick Actions ---
  renderMultiplayerQuickActions() {
    const container = document.getElementById('mpKPQuickActions');
    if (!container) return;
    const actions = KP_QUICK_ACTIONS[state.theme] || KP_QUICK_ACTIONS.dnd;
    container.innerHTML = actions.map(a =>
      `<button class="mp-quick-btn" onclick="App.mpQuickAction('${a}')">${a}</button>`
    ).join('');
  },

  // --- DICE ROLL (multiplayer broadcast) ---
  rollAndBroadcast(diceNotation) {
    let result, detail;
    if (!diceNotation) {
      // Use current dice selection
      const dice = state.currentDice || 20;
      result = Math.floor(Math.random() * dice) + 1;
      detail = `d${dice} = ${result}`;
    } else {
      const match = diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
      if (!match) return;
      const count = parseInt(match[1]) || 1;
      const sides = parseInt(match[2]);
      const mod = parseInt(match[3]) || 0;
      const rolls = [];
      result = 0;
      for (let i = 0; i < count; i++) { const r = Math.floor(Math.random() * sides) + 1; rolls.push(r); result += r; }
      result += mod;
      detail = count > 1 ? `${rolls.join('+')}${mod?(mod>0?'+'+mod:mod):''} = ${result}` : `${diceNotation} = ${result}`;
    }

    const msg = { type: 'dice', playerId: this.playerId, playerName: this.playerName, result, detail };
    if (this.isHost) {
      this.addChatMessage('dice', this.playerName, detail);
      this.broadcastToAll(msg);
    } else {
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send(msg);
        this.addChatMessage('dice', this.playerName, detail);
        this.renderMultiplayerChat();
      }
    }
    this.scrollChatBottom();
    return { result, detail };
  },

  // --- Set Input Mode ---
  setInputMode(mode) {
    this.inputMode = mode;
    document.querySelectorAll('.mp-input-tab').forEach(t => t.classList.remove('active', 'secret-active'));
    const tab = document.querySelector(`.mp-input-tab[data-mp-input="${mode}"]`);
    if (tab) {
      tab.classList.add('active');
      if (mode === 'secret') tab.classList.add('secret-active');
    }
    const input = document.getElementById('mpInput');
    if (input) {
      switch (mode) {
        case 'public': input.placeholder = '输入行动指令，例如「调查书架」...'; break;
        case 'secret': input.placeholder = '秘密行动 (仅KP可见)...'; break;
        case 'chat':   input.placeholder = '发送聊天消息...'; break;
      }
      input.focus();
    }
  },

  // --- Copy Room ID ---
  copyRoomId() {
    if (!this.roomId) return;
    navigator.clipboard?.writeText(this.roomId).then(() => {
      showToast(`房间号 ${this.roomId} 已复制到剪贴板!`);
    }).catch(() => {
      showToast(`房间号: ${this.roomId} (请手动复制)`);
    });
  },

  // --- Update status (HP/SAN changes etc.) ---
  broadcastStatusUpdate() {
    if (!this.connected) return;
    const update = {
      type: 'update-status',
      playerId: this.playerId,
      playerName: this.playerName,
      hp: cocState.currentHp,
      san: cocState.san,
      charName: document.getElementById('charName')?.value?.trim() || ''
    };

    if (this.isHost) {
      if (this.players[this.playerId]) {
        this.players[this.playerId].hp = cocState.currentHp;
        this.players[this.playerId].san = cocState.san;
        this.players[this.playerId].charName = update.charName;
      }
      this.broadcastToAll({ type: 'player-list', players: this.players });
      this.renderPlayerList();
    } else {
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send(update);
      }
    }
  }
};

// Multiplayer input mode tabs
document.addEventListener('click', function(e) {
  const tab = e.target.closest('.mp-input-tab');
  if (tab) {
    Multiplayer.setInputMode(tab.dataset.mpInput);
  }
  // Lobby tabs
  const lobbyTab = e.target.closest('.mp-tab');
  if (lobbyTab) {
    document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mp-tab-panel').forEach(p => p.classList.remove('active'));
    lobbyTab.classList.add('active');
    const panelId = lobbyTab.dataset.mpTab === 'create' ? 'mpTabCreate' : 'mpTabJoin';
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
  }
});

// Multiplayer input Enter key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    const input = document.getElementById('mpInput');
    if (input && document.activeElement === input) {
      e.preventDefault();
      Multiplayer.sendMessage();
    }
  }
});

// Auto-broadcast status when CoC state changes (every 5s if connected)
setInterval(() => {
  if (Multiplayer.connected) {
    Multiplayer.broadcastStatusUpdate();
  }
}, 5000);

// ==================== GLOBAL INIT ====================
function init() {
  // Load saved theme
  const savedTheme = localStorage.getItem('ttrpg-theme');
  if (savedTheme && THEME_NAMES[savedTheme]) selectRPG(savedTheme);

  // Setup UI event listeners
  setupPortrait();

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigateTo(tab.dataset.page));
  });

  // Dice buttons
  document.querySelectorAll('.dice-die').forEach(btn => {
    btn.addEventListener('click', () => selectDice(parseInt(btn.dataset.dice), btn));
  });

  // Enter key handlers
  dom.customDice.addEventListener('keydown', e => { if (e.key==='Enter') rollCustom(); });
  dom.equipName.addEventListener('keydown', e => { if (e.key==='Enter') addEquipment(); });
  dom.initRoll.addEventListener('keydown', e => { if (e.key==='Enter') addInitiative(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '1') navigateTo('home');
    if (e.key === '2') navigateTo('character');
    if (e.key === '3') navigateTo('dice');
    if (e.key === '4') navigateTo('notes');
    if (e.key === '5') navigateTo('multiplayer');
    if (e.key === 'Enter' && document.getElementById('page-dice').classList.contains('active')) rollDice();
  });

  // Initial renders
  renderAllCharacter();
  renderRollHistory();
  renderSessions();
  renderInitiative();
  renderKPQuickActions();

  // Load KP chat history
  loadKPChatHistory();
  loadKPConfig();

  // Particle effects
  initParticles();

  // Cleanup multiplayer on page unload
  window.addEventListener('beforeunload', () => {
    if (Multiplayer.connected) {
      if (Multiplayer.isHost) {
        Multiplayer.broadcastToAll({ type: 'system', content: '🏚️ 房主已离开，房间已关闭' });
      }
      Multiplayer.stopHeartbeat();
    }
  });

  // KP Enter key
  const kpInput = document.getElementById('kpInput');
  if (kpInput) {
    kpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendKPMessage();
      }
    });
  }

  console.log('🎲 TTRPG Companion 已就绪 (含 AI KP + 多人联机)');
  console.log('   %c快捷键: 1首页 2人物卡 3骰子 4笔记 5联机','color:var(--text-gold)');
}

// ==================== PUBLIC API ====================
window.App = {
  selectRPG, navigateTo,
  adjustAttr, toggleSkill,
  addTrait, updateTrait, removeTrait,
  addFeat, updateFeat, removeFeat,
  addEquipment, removeEquip,
  saveCharacter, loadCharacter, deleteCharacter,
  exportCharacter, importCharacterPrompt,
  selectDice, rollDice, rollCustom, clearRollHistory,
  saveSessionNote, loadSession,
  fetchAPI, fetchAPIDetail,
  addInitiative, removeInitiative, nextInitiative, clearInitiative,
  // KP
  openKPPanel, closeKPPanel, clearKPChat,
  sendKPMessage, sendQuickAction, stopKPStreaming,
  toggleKPConfig, toggleKPProviderUI, saveKPConfigFromUI,
  getKPThemeName: () => THEME_NAMES[state.theme],
  getKPQuickActions: () => KP_QUICK_ACTIONS[state.theme] || KP_QUICK_ACTIONS.dnd,
  // Game saves & CoC
  saveGame, loadGame, deleteGame, loadAutosave, renderGameSaves,
  getCocState: () => cocState,
  // Multiplayer
  mpCreateRoom:        () => Multiplayer.createRoom(),
  mpJoinRoom:           () => Multiplayer.joinRoom(),
  mpLeaveRoom:          () => Multiplayer.leaveRoom(),
  mpSendMessage:        () => Multiplayer.sendMessage(),
  mpCopyRoomId:         () => Multiplayer.copyRoomId(),
  mpQuickAction:        (action) => { document.getElementById('mpInput').value = action; Multiplayer.sendMessage(); },
  mpSetInputMode:       (mode) => Multiplayer.setInputMode(mode),
  mpRollAndBroadcast:   (notation) => Multiplayer.rollAndBroadcast(notation),
  isConnected:          () => Multiplayer.connected,
  broadcastStatusUpdate:() => Multiplayer.broadcastStatusUpdate(),
};

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
