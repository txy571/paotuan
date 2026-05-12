// ==================== SESSION NOTES (Enhanced) ====================
// CRUD for run-session notes with Markdown WYSIWYG, multi-select
// export/import, and optional AES-GCM encryption via Web Crypto API.
import { dom } from './dom.js';
import { esc, showToast } from './utils.js';
import { memoryBank } from './memory-bank.js';

// ── Markdown live preview ──────────────────────────
let _previewVisible = true;
let _previewDebounce = null;

export function togglePreview() {
  _previewVisible = !_previewVisible;
  const preview = document.getElementById('notesPreview');
  const toggleBtn = document.getElementById('notesPreviewToggle');
  if (preview) preview.style.display = _previewVisible ? 'block' : 'none';
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', _previewVisible);
    toggleBtn.textContent = _previewVisible ? '预览' : '预览 (关)';
  }
}

export function updatePreview() {
  const preview = document.getElementById('notesPreview');
  if (!preview || !_previewVisible) return;
  const content = document.getElementById('sessionContent')?.value || '';
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    preview.innerHTML = content.trim() ? marked.parse(content) : '<div style="color:var(--text-dim);text-align:center;padding:20px;">输入 Markdown 后这里会实时渲染…</div>';
  } else {
    preview.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">Markdown 解析器加载中…</div>';
  }
}

// Toolbar: insert markdown syntax at cursor
export function insertMarkdown(md) {
  const ta = document.getElementById('sessionContent');
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  ta.value = text.substring(0, start) + md + text.substring(end);
  ta.focus();
  ta.selectionStart = start + md.length;
  ta.selectionEnd = start + md.length;
  ta.dispatchEvent(new Event('input'));
}

// ── Save ──────────────────────────────────────────
export function saveSessionNote() {
  const title = (document.getElementById('sessionTitle')?.value || '').trim();
  const content = (document.getElementById('sessionContent')?.value || '').trim();
  const tagsRaw = (document.getElementById('sessionTags')?.value || '').trim();
  if (!title && !content) { showToast('请先输入笔记内容'); return; }
  const tags = tagsRaw ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');

  // Check if editing existing (by matching title+date prefix, simple approach)
  // We use the oldest matching strategy: if title matches an existing note, update it
  const existingIdx = sessions.findIndex(s => s.title === title);
  const note = {
    id: existingIdx >= 0 ? sessions[existingIdx].id : Date.now().toString(),
    title: title || '未命名',
    content,
    tags,
    date: new Date().toLocaleString(),
    format: 'markdown',
  };

  if (existingIdx >= 0) {
    sessions[existingIdx] = note;
  } else {
    sessions.unshift(note);
  }

  localStorage.setItem('ttrpg-notes', JSON.stringify(sessions));
  if (document.getElementById('sessionTitle')) document.getElementById('sessionTitle').value = '';
  if (document.getElementById('sessionContent')) document.getElementById('sessionContent').value = '';
  if (document.getElementById('sessionTags')) document.getElementById('sessionTags').value = '';
  updatePreview();
  renderSessions();
  _selectedNotes.clear();
  showToast('笔记已保存!');
}

// ── Multi-select state ────────────────────────────
const _selectedNotes = new Set();

export function toggleNoteSelect(id) {
  if (_selectedNotes.has(id)) _selectedNotes.delete(id);
  else _selectedNotes.add(id);
  renderSessions();
}

export function selectAllNotes() {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  if (_selectedNotes.size === sessions.length) {
    _selectedNotes.clear();
  } else {
    sessions.forEach(s => _selectedNotes.add(s.id));
  }
  renderSessions();
}

// ── Render ────────────────────────────────────────
let _currentFilter = null;

export function renderSessions() {
  const list = dom.sessionsList;
  if (!list) return;
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  const filtered = _currentFilter
    ? sessions.filter(s => (s.tags || []).some(t => t === _currentFilter))
    : sessions;

  if (!sessions.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:20px;text-align:center;">暂无记录</div>';
  } else if (filtered.length === 0 && _currentFilter) {
    list.innerHTML = `<div style="color:var(--text-dim);font-size:.82rem;padding:20px;text-align:center;">没有标签为"${esc(_currentFilter)}"的笔记</div>`;
  } else {
    list.innerHTML = filtered.map(s => {
      const checked = _selectedNotes.has(s.id) ? 'checked' : '';
      const selectedClass = _selectedNotes.has(s.id) ? ' selected-note' : '';
      return `
      <div class="note-card${selectedClass}" style="display:flex;align-items:flex-start;">
        <input type="checkbox" class="note-checkbox" ${checked}
          onchange="document.dispatchEvent(new CustomEvent('notes-toggle-select',{detail:'${s.id}'}))"
          onclick="event.stopPropagation()">
        <div style="flex:1;" onclick="document.dispatchEvent(new CustomEvent('load-session',{detail:'${s.id}'}))">
          <div class="note-date">${esc(s.date)}</div>
          <div class="note-title">${esc(s.title)}</div>
          ${(s.tags || []).length ? `<div class="note-tags">${s.tags.map(t => `<span class="note-tag" onclick="event.stopPropagation();document.dispatchEvent(new CustomEvent('notes-filter',{detail:'${esc(t).replace(/'/g, "\\'")}'}))">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // Render tag filter bar
  const allTags = new Set();
  sessions.forEach(s => (s.tags || []).forEach(t => allTags.add(t)));
  const tagBar = document.getElementById('notesTagFilter');
  if (tagBar) {
    tagBar.innerHTML = _currentFilter
      ? `<span class="note-tag active" onclick="document.dispatchEvent(new CustomEvent('notes-filter',{detail:''}))">× 清除筛选: ${esc(_currentFilter)}</span>`
      : [...allTags].sort().map(t =>
          `<span class="note-tag" onclick="document.dispatchEvent(new CustomEvent('notes-filter',{detail:'${esc(t).replace(/'/g, "\\'")}'}))">${esc(t)}</span>`
        ).join('');
  }

  const lbl = document.getElementById('notesFilterLabel');
  if (lbl) lbl.textContent = _currentFilter ? ` — 筛选: ${_currentFilter}` : '';

  // Update count
  const countEl = document.getElementById('notesCount');
  if (countEl) countEl.textContent = `${sessions.length} 篇笔记`;

  // Update select-all label
  const selAll = document.querySelector('.note-select-all');
  if (selAll) selAll.textContent = _selectedNotes.size === sessions.length && sessions.length > 0 ? '取消全选' : '全选';
}

// Tag filter handler
export function filterNotesByTag(tag) {
  _currentFilter = tag || null;
  renderSessions();
}

export function loadSession(id) {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  const s = sessions.find(x => x.id === id);
  if (s) {
    const titleEl = document.getElementById('sessionTitle');
    const contentEl = document.getElementById('sessionContent');
    const tagsEl = document.getElementById('sessionTags');
    if (titleEl) titleEl.value = s.title;
    if (contentEl) contentEl.value = s.content || '';
    if (tagsEl) tagsEl.value = (s.tags || []).join(', ');
    updatePreview();
    showToast('笔记已加载');
  }
}

// ── Export ─────────────────────────────────────────
export function exportNotes(selectedOnly) {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  let toExport;
  if (selectedOnly) {
    toExport = sessions.filter(s => _selectedNotes.has(s.id));
    if (!toExport.length) { showToast('请先选择要导出的笔记'); return; }
  } else {
    toExport = sessions;
    if (!toExport.length) { showToast('没有可导出的笔记'); return; }
  }
  _downloadJSON(toExport.map(s => ({ ...s, encrypted: false })), `ttrpg-notes-${new Date().toISOString().slice(0,10)}.json`);
  showToast(`已导出 ${toExport.length} 篇笔记`);
  _selectedNotes.clear();
  renderSessions();
}

export function exportSelected() { exportNotes(true); }

// ── Encrypted Export ──────────────────────────────
export async function exportEncrypted() {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  let toExport;
  if (_selectedNotes.size > 0) {
    toExport = sessions.filter(s => _selectedNotes.has(s.id));
  } else {
    toExport = sessions;
  }
  if (!toExport.length) { showToast('没有可导出的笔记'); return; }

  const password = prompt('请输入加密密码（请牢记，丢失无法恢复）:');
  if (!password) return;

  try {
    const data = JSON.stringify(toExport.map(s => ({ ...s, encrypted: false })));
    const enc = await encryptData(data, password);
    const blob = new Blob([JSON.stringify(enc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ttrpg-notes-encrypted-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`已加密导出 ${toExport.length} 篇笔记`);
    _selectedNotes.clear();
    renderSessions();
  } catch (err) {
    console.error('Encryption failed:', err);
    showToast('加密失败，请重试');
  }
}

// ── Import ────────────────────────────────────────
export function importNotesPrompt() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let data = JSON.parse(text);
      // Detect encrypted
      if (data.encrypted === true) {
        const password = prompt('此文件已加密，请输入密码:');
        if (!password) return;
        try {
          const decrypted = await decryptData(data, password);
          data = JSON.parse(decrypted);
        } catch (_) {
          showToast('密码错误或文件损坏');
          return;
        }
      }
      // Validate and merge
      if (!Array.isArray(data)) { showToast('文件格式不正确，需要笔记 JSON 数组'); return; }
      const existing = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
      const existingIds = new Set(existing.map(s => s.id));
      let imported = 0;
      for (const note of data) {
        if (!note.id || !note.title === undefined) continue;
        // Remove encryption envelope if present
        if (note.encrypted === true) continue;
        if (!existingIds.has(note.id)) {
          existing.push(note);
          existingIds.add(note.id);
          imported++;
        }
      }
      // Sort by date desc (simple: reverse push order)
      existing.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      localStorage.setItem('ttrpg-notes', JSON.stringify(existing));
      renderSessions();
      showToast(`已导入 ${imported} 篇笔记 (跳过 ${data.length - imported} 篇重复)`);
    } catch (_) {
      showToast('文件格式错误，无法导入');
    }
  };
  input.click();
}

// ── Web Crypto helpers ────────────────────────────
async function encryptData(plaintext, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    encrypted: true,
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

async function decryptData(envelope, password) {
  const enc = new TextEncoder();
  const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(envelope.salt), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(envelope.data), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

function _downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Memory Bank Reference Panel ───────────────────
export function renderNotesReference() {
  const el = document.getElementById('notesRefContent');
  if (!el) return;

  let html = '';

  const activeThreads = memoryBank.plotThreads.filter(p => p.status === 'open');
  if (activeThreads.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--text-gold);">📌 进行中的剧情</strong>';
    html += activeThreads.map(p =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(p.title)}: ${esc(p.summary).substring(0,60)}</div>`
    ).join('');
    html += '</div>';
  }

  const unpaid = memoryBank.foreshadowing.filter(f => !f.payOff);
  if (unpaid.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--accent2);">🔮 待回收的伏笔</strong>';
    html += unpaid.map(f =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(f.hint).substring(0,80)} <span style="color:var(--text-dim);">[${f.plantedAt}]</span></div>`
    ).join('');
    html += '</div>';
  }

  const npcs = memoryBank.npcs.slice(-10);
  if (npcs.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--accent);">👤 已知NPC</strong>';
    html += npcs.map(n => {
      const p = n.personality || {};
      return `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· <strong>${esc(n.name)}</strong>${n.attitude ? ' [' + esc(n.attitude) + ']' : ''} — ${esc(n.description || '').substring(0,50)}${p.speech ? ' <span style="color:var(--text-dim);">「' + esc(p.speech) + '」</span>' : ''}</div>`;
    }).join('');
    html += '</div>';
  }

  const clues = memoryBank.clues.filter(c => !c.revealed).slice(-8);
  if (clues.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--text-dim);">🔍 未揭示线索</strong>';
    html += clues.map(c =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(c.description).substring(0,80)}</div>`
    ).join('');
    html += '</div>';
  }

  const decisions = memoryBank.decisions.slice(-8);
  if (decisions.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--text-dim);">⚡ 重要决策</strong>';
    html += decisions.map(d =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(d.description).substring(0,60)}${d.consequence ? ' → <span style="color:var(--text-dim);">' + esc(d.consequence).substring(0,40) + '</span>' : ''}</div>`
    ).join('');
    html += '</div>';
  }

  if (!html) {
    html = '<div style="color:var(--text-dim);font-size:.78rem;text-align:center;padding:12px;">游戏进行中时将自动填充...</div>';
  }

  el.innerHTML = html;
}
