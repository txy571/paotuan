// ==================== STRUCTURED SCENARIO LIBRARY ====================
import { scenarioDbContent, setScenarioDbContent, scenarioLibrary, activeScenario, setActiveScenario } from './state.js';
import { showToast, esc } from './utils.js';

const STORAGE_KEY = 'ttrpg-scenario-library';
const ACTIVE_KEY = 'ttrpg-active-scenario';

// ── Persistence ─────────────────────────────────
export function loadScenarioLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      scenarioLibrary.length = 0;
      scenarioLibrary.push(...saved);
    }
  } catch(e) { /* ignore */ }
}

export function saveScenarioLibrary() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarioLibrary));
  } catch(e) { showToast('保存剧本库失败: ' + e.message); }
}

export function loadActiveScenario() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_KEY));
    if (saved) setActiveScenario(saved);
  } catch(e) { setActiveScenario(null); }
}

function saveActiveScenario() {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeScenario));
  } catch(e) { /* ignore */ }
}

// ── CRUD ────────────────────────────────────────
export function createScenario(data) {
  const sc = {
    id: 'sc_' + Date.now(),
    name: data.name || '未命名剧本',
    background: data.background || '',
    era: data.era || '',
    playerCount: data.playerCount || '',
    suggestedActs: data.suggestedActs || 3,
    keyNPCs: data.keyNPCs || [],
    keyLocations: data.keyLocations || [],
    keyClues: data.keyClues || [],
    plotHooks: data.plotHooks || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  scenarioLibrary.push(sc);
  saveScenarioLibrary();
  renderScenarioLibrary();
  showToast('剧本已创建!');
  return sc;
}

export function updateScenario(id, data) {
  const sc = scenarioLibrary.find(s => s.id === id);
  if (!sc) return;
  Object.assign(sc, data, { updatedAt: new Date().toISOString() });
  saveScenarioLibrary();
  renderScenarioLibrary();
  showToast('剧本已更新!');
}

export function deleteScenario(id) {
  if (!confirm('确定要删除这个剧本吗？此操作不可撤销。')) return;
  const idx = scenarioLibrary.findIndex(s => s.id === id);
  if (idx >= 0) {
    scenarioLibrary.splice(idx, 1);
    saveScenarioLibrary();
    renderScenarioLibrary();
    if (activeScenario?.id === id) {
      setActiveScenario(null);
      saveActiveScenario();
    }
    showToast('剧本已删除');
  }
}

export function activateScenario(id) {
  const sc = scenarioLibrary.find(s => s.id === id);
  if (sc) {
    setActiveScenario(sc);
    saveActiveScenario();
    renderScenarioLibrary();
    showToast(`已激活剧本: ${sc.name}`);
  }
}

export function deactivateScenario() {
  setActiveScenario(null);
  saveActiveScenario();
  renderScenarioLibrary();
  showToast('已取消剧本激活');
}

// ── Toggle panel (replaces old toggleScenarioDB) ──
export function toggleScenarioLibrary() {
  const wrapper = document.getElementById('scenarioLibraryWrapper');
  if (!wrapper) return;
  if (wrapper.style.display === 'none' || wrapper.style.display === '') {
    wrapper.style.display = '';
    renderScenarioLibrary();
  } else {
    wrapper.style.display = 'none';
  }
}

export function closeScenarioLibrary() {
  const wrapper = document.getElementById('scenarioLibraryWrapper');
  if (wrapper) wrapper.style.display = 'none';
}

// ── Rendering ───────────────────────────────────
export function renderScenarioLibrary() {
  const container = document.getElementById('scenarioLibraryList');
  if (!container) return;
  if (!scenarioLibrary.length) {
    container.innerHTML = '<div class="empty-state">暂无剧本。点击"+ 新建"创建你的第一个结构化剧本。</div>';
    return;
  }
  container.innerHTML = scenarioLibrary.map(sc => `
    <div class="scenario-card ${activeScenario?.id === sc.id ? 'active-scenario' : ''}">
      <div class="scenario-card-header">
        <span class="scenario-card-name">${esc(sc.name)}</span>
        ${activeScenario?.id === sc.id ? '<span class="scenario-active-badge">激活中</span>' : ''}
      </div>
      <div class="scenario-card-meta">
        ${sc.era ? esc(sc.era) + ' · ' : ''}${sc.playerCount ? esc(sc.playerCount) + ' · ' : ''}${sc.suggestedActs}幕
      </div>
      <div class="scenario-card-desc">${esc((sc.background || '').substring(0, 80))}</div>
      <div class="scenario-card-actions">
        <button class="btn btn-xs btn-secondary" data-action="scenario:activate" data-id="${sc.id}">${activeScenario?.id === sc.id ? '✓ 已激活' : '激活'}</button>
        <button class="btn btn-xs btn-ghost" data-action="scenario:edit" data-id="${sc.id}">编辑</button>
        <button class="btn btn-xs btn-ghost" data-action="scenario:delete" data-id="${sc.id}" style="color:var(--accent2);">删除</button>
      </div>
    </div>
  `).join('');
}

// ── Edit Form ───────────────────────────────────
export function showScenarioForm(id) {
  const form = document.getElementById('scenarioEditForm');
  if (!form) return;
  form.style.display = '';
  const existing = id ? scenarioLibrary.find(s => s.id === id) : null;

  const npcFields = (existing?.keyNPCs || [{name:'',description:''}]).map((n,i) => `
    <div class="scenario-array-field">
      <input type="text" placeholder="NPC名称" data-snpc-n="${i}" value="${esc(n.name||'')}" style="width:40%;margin-right:6px;">
      <input type="text" placeholder="描述" data-snpc-d="${i}" value="${esc(n.description||'')}" style="width:55%;">
    </div>`).join('');

  const locFields = (existing?.keyLocations || [{name:'',description:''}]).map((l,i) => `
    <div class="scenario-array-field">
      <input type="text" placeholder="地点名称" data-sloc-n="${i}" value="${esc(l.name||'')}" style="width:40%;margin-right:6px;">
      <input type="text" placeholder="描述" data-sloc-d="${i}" value="${esc(l.description||'')}" style="width:55%;">
    </div>`).join('');

  const clueFields = (existing?.keyClues || [{name:'',description:''}]).map((c,i) => `
    <div class="scenario-array-field">
      <input type="text" placeholder="线索名称" data-sclue-n="${i}" value="${esc(c.name||'')}" style="width:40%;margin-right:6px;">
      <input type="text" placeholder="描述" data-sclue-d="${i}" value="${esc(c.description||'')}" style="width:55%;">
    </div>`).join('');

  const hooksText = (existing?.plotHooks || ['']).join('\n');

  form.innerHTML = `
    <div class="scenario-edit-form">
      <input type="hidden" id="scenarioEditId" value="${existing?.id || ''}">
      <div class="form-row">
        <label style="color:var(--text);">剧本名称 *</label>
        <input type="text" id="scenarioFormName" value="${esc(existing?.name || '')}">
      </div>
      <div class="form-row">
        <label style="color:var(--text);">剧本背景</label>
        <textarea id="scenarioFormBackground" rows="3">${esc(existing?.background || '')}</textarea>
      </div>
      <div style="display:flex;gap:10px;">
        <div class="form-row" style="flex:1;"><label style="color:var(--text);">年代</label><input type="text" id="scenarioFormEra" value="${esc(existing?.era || '')}"></div>
        <div class="form-row" style="flex:1;"><label style="color:var(--text);">玩家人数</label><input type="text" id="scenarioFormPlayerCount" value="${esc(existing?.playerCount || '')}"></div>
        <div class="form-row" style="flex:1;"><label style="color:var(--text);">建议幕数</label><input type="number" id="scenarioFormActs" value="${existing?.suggestedActs || 3}" min="1" max="10"></div>
      </div>
      <div class="form-row">
        <label style="color:var(--text);">关键NPC</label>
        <div id="scenarioFormNPCs">${npcFields || '<div class="scenario-array-field" style="color:var(--text-dim);">暂无，点击下方按钮添加</div>'}</div>
        <button class="btn btn-xs btn-ghost" data-action="scenario:addNpc" type="button">+ 添加NPC</button>
      </div>
      <div class="form-row">
        <label style="color:var(--text);">关键地点</label>
        <div id="scenarioFormLocations">${locFields || '<div class="scenario-array-field" style="color:var(--text-dim);">暂无，点击下方按钮添加</div>'}</div>
        <button class="btn btn-xs btn-ghost" data-action="scenario:addLocation" type="button">+ 添加地点</button>
      </div>
      <div class="form-row">
        <label style="color:var(--text);">关键线索</label>
        <div id="scenarioFormClues">${clueFields || '<div class="scenario-array-field" style="color:var(--text-dim);">暂无，点击下方按钮添加</div>'}</div>
        <button class="btn btn-xs btn-ghost" data-action="scenario:addClue" type="button">+ 添加线索</button>
      </div>
      <div class="form-row">
        <label style="color:var(--text);">剧情钩子（每行一个）</label>
        <textarea id="scenarioFormHooks" rows="3">${esc(hooksText)}</textarea>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn btn-save btn-sm" data-action="scenario:save">${existing ? '更新剧本' : '创建剧本'}</button>
        <button class="btn btn-ghost btn-sm" data-action="scenario:cancelEdit">取消</button>
      </div>
    </div>`;
  form.scrollIntoView({ behavior: 'smooth' });
}

export function saveScenarioFromForm() {
  const id = document.getElementById('scenarioEditId')?.value;
  const data = {
    name: document.getElementById('scenarioFormName')?.value?.trim() || '未命名剧本',
    background: document.getElementById('scenarioFormBackground')?.value?.trim() || '',
    era: document.getElementById('scenarioFormEra')?.value?.trim() || '',
    playerCount: document.getElementById('scenarioFormPlayerCount')?.value?.trim() || '',
    suggestedActs: parseInt(document.getElementById('scenarioFormActs')?.value) || 3,
    keyNPCs: [],
    keyLocations: [],
    keyClues: [],
    plotHooks: (document.getElementById('scenarioFormHooks')?.value || '').split('\n').map(s=>s.trim()).filter(Boolean),
  };
  document.querySelectorAll('[data-snpc-n]').forEach((el, i) => {
    const name = el.value.trim();
    const desc = document.querySelector(`[data-snpc-d="${i}"]`)?.value?.trim() || '';
    if (name) data.keyNPCs.push({ name, description: desc });
  });
  document.querySelectorAll('[data-sloc-n]').forEach((el, i) => {
    const name = el.value.trim();
    const desc = document.querySelector(`[data-sloc-d="${i}"]`)?.value?.trim() || '';
    if (name) data.keyLocations.push({ name, description: desc });
  });
  document.querySelectorAll('[data-sclue-n]').forEach((el, i) => {
    const name = el.value.trim();
    const desc = document.querySelector(`[data-sclue-d="${i}"]`)?.value?.trim() || '';
    if (name) data.keyClues.push({ name, description: desc });
  });
  if (id) updateScenario(id, data);
  else createScenario(data);
  hideScenarioForm();
}

export function hideScenarioForm() {
  const form = document.getElementById('scenarioEditForm');
  if (form) { form.style.display = 'none'; form.innerHTML = ''; }
}

export function addFormArrayField(type) {
  const prefix = type === 'npc' ? 'snpc' : type === 'loc' ? 'sloc' : 'sclue';
  const containerId = type === 'npc' ? 'scenarioFormNPCs' : type === 'loc' ? 'scenarioFormLocations' : 'scenarioFormClues';
  const container = document.getElementById(containerId);
  if (!container) return;
  const idx = container.querySelectorAll('[data-' + prefix + '-n]').length;
  const div = document.createElement('div');
  div.className = 'scenario-array-field';
  div.innerHTML = `<input type="text" placeholder="${type==='npc'?'NPC名称':type==='loc'?'地点名称':'线索名称'}" data-${prefix}-n="${idx}" style="width:40%;margin-right:6px;">
    <input type="text" placeholder="描述" data-${prefix}-d="${idx}" style="width:55%;">`;
  container.appendChild(div);
}

// ── Export/Import ───────────────────────────────
export function exportScenarioLibrary() {
  const blob = new Blob([JSON.stringify(scenarioLibrary, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ttrpg-scenario-library.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('剧本库已导出!');
}

export function importScenarioLibraryPrompt() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('格式错误');
        scenarioLibrary.length = 0;
        scenarioLibrary.push(...data);
        saveScenarioLibrary();
        renderScenarioLibrary();
        showToast(`已导入 ${data.length} 个剧本`);
      } catch(err) {
        showToast('导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── Legacy compatibility: keep old loadScenarioDB working ──
export function loadScenarioDB() {
  try {
    const saved = localStorage.getItem('ttrpg-scenario-db');
    if (saved) setScenarioDbContent(saved);
    const ta = document.getElementById('scenarioDbContent');
    if (ta) ta.value = scenarioDbContent;
  } catch(e) { /* ignore */ }
}

export function saveScenarioDB() {
  const ta = document.getElementById('scenarioDbContent');
  if (!ta) return;
  setScenarioDbContent(ta.value);
  try {
    localStorage.setItem('ttrpg-scenario-db', scenarioDbContent);
    showToast('剧本知识库已保存!');
  } catch(e) { showToast('保存失败: ' + e.message); }
}

// toggleScenarioDB now opens the new structured library
export function toggleScenarioDB() {
  toggleScenarioLibrary();
}

export function closeScenarioDB() {
  closeScenarioLibrary();
}

export function exportScenarioDB() {
  exportScenarioLibrary();
}

export function importScenarioDBPrompt() {
  importScenarioLibraryPrompt();
}
