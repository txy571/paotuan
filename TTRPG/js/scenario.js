// ==================== SCENARIO KNOWLEDGE DATABASE ====================
import { scenarioDbContent, setScenarioDbContent } from './state.js';
import { showToast } from './utils.js';

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
  } catch(e) {
    showToast('保存失败: ' + e.message);
  }
}

export function toggleScenarioDB() {
  const wrapper = document.getElementById('scenarioDbWrapper');
  if (!wrapper) return;
  if (wrapper.style.display === 'none' || wrapper.style.display === '') {
    wrapper.style.display = '';
    const ta = document.getElementById('scenarioDbContent');
    if (ta && !ta.value) ta.value = scenarioDbContent;
  } else {
    wrapper.style.display = 'none';
  }
}

export function closeScenarioDB() {
  const wrapper = document.getElementById('scenarioDbWrapper');
  if (wrapper) wrapper.style.display = 'none';
}

export function exportScenarioDB() {
  const content = scenarioDbContent || document.getElementById('scenarioDbContent')?.value || '';
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ttrpg-scenario-db.txt'; a.click();
  URL.revokeObjectURL(a.href);
  showToast('剧本知识库已导出!');
}

export function importScenarioDBPrompt() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt,.json';
  input.onchange = function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const ta = document.getElementById('scenarioDbContent');
      if (ta) ta.value = ev.target.result;
      saveScenarioDB();
      showToast('剧本知识库已导入!');
    };
    reader.readAsText(file);
  };
  input.click();
}
