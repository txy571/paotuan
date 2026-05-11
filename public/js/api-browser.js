// ==================== D&D 5e API BROWSER ====================
// Fetches data from the open dnd5eapi.co REST API (SRD content).
// Displays paginated lists of races, classes, spells, monsters, equipment, feats
// with click-to-expand detail cards. Used on the home page reference panel.
import { dom } from './dom.js';
import { esc } from './utils.js';

const API_BASE = 'https://www.dnd5eapi.co/api';

export async function fetchAPI(endpoint) {
  const container = dom.apiResults;
  if (!container) return;
  container.innerHTML = '<div class="loading-state">正在从 D&D 5e API 获取数据...</div>';
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    container.innerHTML =
      `<p style="color:var(--text-dim);margin-bottom:10px;font-size:.82rem;">共 ${data.count} 条结果，显示前 ${Math.min(data.results.length, 30)} 条</p>
       <div class="api-grid">${data.results.slice(0,30).map(item => `
        <div class="api-card" onclick="document.dispatchEvent(new CustomEvent('fetch-detail',{detail:{endpoint:'${endpoint}',index:'${item.index}'}}))">
          <h4>${item.name}</h4>
          <div class="api-desc">点击查看详情</div>
        </div>`).join('')}</div>`;
  } catch(err) {
    container.innerHTML = `<div class="error-state">API 请求失败: ${err.message}<br><small>请检查网络连接，或确认已通过 HTTP 服务器打开此页面</small></div>`;
  }
}

export async function fetchAPIDetail(endpoint, index) {
  const container = dom.apiResults;
  if (!container) return;
  container.innerHTML = '<div class="loading-state">获取详情中...</div>';
  try {
    const resp = await fetch(`${API_BASE}/${endpoint}/${index}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    let html = `<button class="btn btn-ghost btn-sm" style="margin-bottom:14px;" onclick="document.dispatchEvent(new CustomEvent('fetch-api',{detail:'${endpoint}'}))">← 返回列表</button>`;
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
    container.innerHTML = `<div class="error-state">获取详情失败: ${err.message}</div>`;
  }
}
