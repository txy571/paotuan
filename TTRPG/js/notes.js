import { dom } from './dom.js';
import { esc, showToast } from './utils.js';

export function saveSessionNote() {
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

export function renderSessions() {
  const list = dom.sessionsList;
  if (!list) return;
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  if (!sessions.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:.82rem;padding:20px;text-align:center;">暂无记录</div>';
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="note-card" onclick="document.dispatchEvent(new CustomEvent('load-session',{detail:'${s.id}'}))">
      <div class="note-date">${s.date}</div>
      <div class="note-title">${esc(s.title)}</div>
    </div>`).join('');
}

export function loadSession(id) {
  const sessions = JSON.parse(localStorage.getItem('ttrpg-notes') || '[]');
  const s = sessions.find(x => x.id === id);
  if (s) {
    dom.sessionTitle.value = s.title;
    dom.sessionContent.value = s.content;
    showToast('笔记已加载');
  }
}
