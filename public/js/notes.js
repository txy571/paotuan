// ==================== SESSION NOTES ====================
// CRUD for run-session notes stored in localStorage.
// Each note has title, content, tags, and timestamp.
import { dom } from './dom.js';
import { esc, showToast } from './utils.js';
import { memoryBank, getMemorySummary } from './memory-bank.js';

export function saveSessionNote() {
  const title = (document.getElementById('sessionTitle')?.value || '').trim();
  const content = (document.getElementById('sessionContent')?.value || '').trim();
  const tagsRaw = (document.getElementById('sessionTags')?.value || '').trim();
  if (!title && !content) { showToast('请先输入笔记内容'); return; }
  const tags = tagsRaw ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  sessions.unshift({
    id: Date.now().toString(),
    title: title || '未命名',
    content,
    tags,
    date: new Date().toLocaleString(),
  });
  localStorage.setItem('ttrpg-notes', JSON.stringify(sessions));
  if (document.getElementById('sessionTitle')) document.getElementById('sessionTitle').value = '';
  if (document.getElementById('sessionContent')) document.getElementById('sessionContent').value = '';
  if (document.getElementById('sessionTags')) document.getElementById('sessionTags').value = '';
  renderSessions();
  showToast('笔记已保存!');
}

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
    list.innerHTML = filtered.map(s => `
      <div class="note-card" onclick="document.dispatchEvent(new CustomEvent('load-session',{detail:'${s.id}'}))">
        <div class="note-date">${s.date}</div>
        <div class="note-title">${esc(s.title)}</div>
        ${(s.tags || []).length ? `<div class="note-tags">${s.tags.map(t => `<span class="note-tag" onclick="event.stopPropagation();document.dispatchEvent(new CustomEvent('notes-filter',{detail:'${esc(t).replace(/'/g, "\\'")}'}))">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`).join('');
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
    if (contentEl) contentEl.value = s.content;
    if (tagsEl) tagsEl.value = (s.tags || []).join(', ');
    showToast('笔记已加载');
  }
}

// Export all notes as JSON
export function exportNotes() {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  if (!sessions.length) { showToast('没有可导出的笔记'); return; }
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ttrpg-notes-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`已导出 ${sessions.length} 篇笔记`);
}

// ── Memory Bank Reference Panel ───────────────────
export function renderNotesReference() {
  const el = document.getElementById('notesRefContent');
  if (!el) return;

  let html = '';

  // Active plot threads
  const activeThreads = memoryBank.plotThreads.filter(p => p.status === 'open');
  if (activeThreads.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--text-gold);">📌 进行中的剧情</strong>';
    html += activeThreads.map(p =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(p.title)}: ${esc(p.summary).substring(0,60)}</div>`
    ).join('');
    html += '</div>';
  }

  // Unpaid foreshadowing
  const unpaid = memoryBank.foreshadowing.filter(f => !f.payOff);
  if (unpaid.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--accent2);">🔮 待回收的伏笔</strong>';
    html += unpaid.map(f =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(f.hint).substring(0,80)} <span style="color:var(--text-dim);">[${f.plantedAt}]</span></div>`
    ).join('');
    html += '</div>';
  }

  // Recent NPCs with personality
  const npcs = memoryBank.npcs.slice(-10);
  if (npcs.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--accent);">👤 已知NPC</strong>';
    html += npcs.map(n => {
      const p = n.personality || {};
      return `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· <strong>${esc(n.name)}</strong>${n.attitude ? ' [' + esc(n.attitude) + ']' : ''} — ${esc(n.description || '').substring(0,50)}${p.speech ? ' <span style="color:var(--text-dim);">「' + esc(p.speech) + '」</span>' : ''}</div>`;
    }).join('');
    html += '</div>';
  }

  // Unrevealed clues
  const clues = memoryBank.clues.filter(c => !c.revealed).slice(-8);
  if (clues.length) {
    html += '<div style="margin-bottom:12px;"><strong style="font-size:.78rem;color:var(--text-dim);">🔍 未揭示线索</strong>';
    html += clues.map(c =>
      `<div class="note-ref-item" style="font-size:.72rem;padding:2px 0;">· ${esc(c.description).substring(0,80)}</div>`
    ).join('');
    html += '</div>';
  }

  // Recent decisions
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
