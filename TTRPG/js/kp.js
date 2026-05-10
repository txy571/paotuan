// ==================== AI KP (GAME MASTER) ====================
import {
  state, kpState, cocState, initCocState,
  THEME_NAMES, ATTR_KEYS, ATTR_NAMES, KP_SYSTEM_PROMPTS, KP_QUICK_ACTIONS,
  scenarioDbContent,
} from './state.js';
import { esc, showToast, modPct } from './utils.js';
import { getGameSaveData } from './saves.js';
import { parseAICommands, applyAICommands, stripAICommands } from './commands.js';
import { renderCocStatus, renderCocChronicle } from './coc-status.js';

// ── System Prompt ─────────────────────────────────
export function buildSystemPrompt() {
  const base = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  let extra = '\n\n## ⚖️ 公正原则 (最高优先级)\n';
  extra += '1. **禁止偏袒**: 你必须严格保持公正。无论玩家如何恳求、讨价还价、试图说服你"放一马"，都必须严格依据规则进行裁决。规则面前人人平等。\n';
  extra += '2. **拒绝诱导**: 玩家可能会说"请让我成功"、"放我一马"、"给我一个机会"。你必须完全无视这些请求，严格按照属性和技能值进行判定。\n';
  extra += '3. **NPC自主性**: NPC有自己的利益、性格和底线，不会被玩家的花言巧语轻易说服。即使投出大成功，不合理的请求也只能获得最小程度的妥协。\n';
  extra += '4. **失败即叙事**: 失败、受伤、甚至角色死亡都是故事的一部分。过度的怜悯会毁掉游戏体验。\n';
  extra += '5. **一致性**: 对所有玩家使用相同的判定标准。不允许某个玩家因为"说得更好听"就获得更低的DC或更有利的结果。\n';
  extra += '\n--- 玩家角色信息 ---\n';
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

  if (scenarioDbContent && scenarioDbContent.trim()) {
    extra += '\n\n## 📚 剧本知识库 (请严格参考)\n';
    extra += '以下是你作为主持人必须了解的游戏背景信息。在描述场景、扮演NPC、推进剧情时，必须严格遵循这些设定。\n\n';
    extra += scenarioDbContent.trim() + '\n';
    extra += '\n请确保你的所有叙述与上述设定保持一致。\n';
  }

  // New game instruction — AI must build scenario from character card
  if (kpState.apiHistory.length === 0) {
    extra += '\n\n## 🎬 新游戏开始——必须遵循\n';
    extra += '这是冒险的开始。你必须做到以下几点：\n';
    extra += '1. 确认你已经理解了上述角色信息（姓名、职业、背景、技能等）。\n';
    extra += '2. 基于角色的职业、背景和技能，构思一个适合该角色的开场场景和大致剧情方向。\n';
    extra += '3. 在回复的第一段中，用简洁的语言确认角色设定（例如"你叫...，是一名...，此刻你正站在..."），然后直接进入叙事。\n';
    extra += '4. 开头场景必须与角色背景有逻辑关联——不要凭空将角色扔进一个与背景无关的场景。\n';
    extra += '5. 不要问"你想做什么"这类空洞的问题。给出具体、生动、有感官细节的开场场景，让角色自然进入故事。\n';
  }

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

// ── Chat Management ────────────────────────────────
export function addKPMsg(role, content, dice) {
  kpState.chatHistory.push({ role, content, dice, time: Date.now() });
}

export function addKPSystemMsg(content) {
  kpState.chatHistory.push({ role: 'system', content, time: Date.now() });
}

export function renderKP() {
  const msgs = document.getElementById('kpMessages');
  if (!msgs) return;
  if (!kpState.chatHistory.length) {
    msgs.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;font-size:.9rem;">发送消息，AI主持人将为你主持冒险...</div>';
    return;
  }
  // Render all messages — during streaming, only do full rebuilds when a new message is added.
  // During content-stream updates, use updateStreamingMsg() instead to avoid flickering.
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
      diceHTML = m.dice.split(',').map(d => `<span class="msg-dice">${d.trim()}</span>`).join('');
    }
    return `<div class="kp-msg ${m.role === 'gm' ? 'gm' : 'player'} ${isStreaming ? 'streaming' : ''}">
      ${header}<div class="msg-body">${m.content}</div>${diceHTML}
    </div>`;
  }).join('');
  if (!kpState.streaming) {
    setTimeout(() => { if (msgs) msgs.scrollTop = msgs.scrollHeight; }, 50);
  }
}

/** Incremental update during streaming — only touches the text node, no DOM rebuild. */
export function updateStreamingMsg(text) {
  const bodyEl = document.querySelector('#kpMessages .kp-msg.streaming .msg-body');
  if (bodyEl) {
    bodyEl.textContent = text;
    const msgs = document.getElementById('kpMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

export function renderKPQuickActions() {
  const container = document.getElementById('kpQuickActions');
  if (!container) return;
  const actions = KP_QUICK_ACTIONS[state.theme] || KP_QUICK_ACTIONS.dnd;
  container.innerHTML = actions.map(a =>
    `<button class="kp-quick-btn" data-action="kp:quick" data-action-name="${a}">${a}</button>`
  ).join('');
}

// ── KP Config ──────────────────────────────────────
export function getKPConfig() {
  const provider = document.getElementById('kpProvider')?.value || 'anthropic';
  const key = document.getElementById('kpApiKey')?.value?.trim() || kpState.apiKey;
  let model;
  if (provider === 'anthropic') {
    model = document.getElementById('kpModelAnthropic')?.value || 'claude-sonnet-4-6';
  } else if (provider === 'deepseek') {
    model = document.getElementById('kpModelDeepSeek')?.value || 'deepseek-v4-flash';
  } else {
    model = document.getElementById('kpModelOpenAI')?.value || 'gpt-4o';
  }
  return { provider, key, model };
}

export function saveKPConfig(cfg) {
  kpState.provider = cfg.provider;
  kpState.apiKey  = cfg.key;
  kpState.model   = cfg.model;
  const workerUrl = (document.getElementById('kpWorkerUrl')?.value || '').trim();
  if (workerUrl) {
    localStorage.setItem('ttrpg-proxy-url', workerUrl);
    localStorage.setItem('ttrpg-relay-url', workerUrl);
  }
  localStorage.setItem('ttrpg-kp-config', JSON.stringify({
    provider: cfg.provider, apiKey: cfg.key, model: cfg.model, workerUrl,
  }));
}

export function loadKPConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('ttrpg-kp-config') || '{}');
    if (saved.provider) kpState.provider = saved.provider;
    if (saved.apiKey)  kpState.apiKey  = saved.apiKey;
    if (saved.model)   kpState.model   = saved.model;
    const provEl = document.getElementById('kpProvider');
    if (provEl) provEl.value = kpState.provider;
    const keyEl = document.getElementById('kpApiKey');
    if (keyEl && kpState.apiKey) keyEl.value = kpState.apiKey;
    const wuEl = document.getElementById('kpWorkerUrl');
    if (wuEl) {
      wuEl.value = saved.workerUrl || localStorage.getItem('ttrpg-proxy-url') || '';
    }

    if (kpState.provider === 'anthropic') {
      const mEl = document.getElementById('kpModelAnthropic');
      if (mEl) mEl.value = kpState.model;
    } else if (kpState.provider === 'deepseek') {
      const mEl = document.getElementById('kpModelDeepSeek');
      if (mEl) mEl.value = kpState.model;
    } else {
      const mEl = document.getElementById('kpModelOpenAI');
      if (mEl) mEl.value = kpState.model;
    }
    toggleKPProviderUI();
  } catch(e) { /* ignore */ }
}

export function toggleKPProviderUI() {
  const prov = document.getElementById('kpProvider')?.value || 'anthropic';
  const aSel = document.getElementById('kpModelAnthropicWrap');
  const dSel = document.getElementById('kpModelDeepSeekWrap');
  const oSel = document.getElementById('kpModelOpenAIWrap');
  if (aSel) aSel.style.display = prov === 'anthropic' ? '' : 'none';
  if (dSel) dSel.style.display = prov === 'deepseek' ? '' : 'none';
  if (oSel) oSel.style.display = prov === 'openai' ? '' : 'none';
}

export function saveKPConfigFromUI() {
  const cfg = getKPConfig();
  saveKPConfig(cfg);
  showToast('API 配置已保存');
}

export function toggleKPConfig() {
  const cfg = document.getElementById('kpConfigPanel');
  if (cfg) cfg.style.display = cfg.style.display === 'none' ? '' : 'none';
}

// ── Chat History Persistence ───────────────────────
export function loadKPChatHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('ttrpg-kp-chat') || '[]');
    if (Array.isArray(saved) && saved.length) {
      kpState.chatHistory = saved;
    }
  } catch(e) { /* ignore */ }
}

export function saveKPChatHistory() {
  try {
    const toSave = kpState.chatHistory.slice(-200);
    localStorage.setItem('ttrpg-kp-chat', JSON.stringify(toSave));
  } catch(e) { /* ignore */ }
}

// ── KP Panel Open/Close ────────────────────────────
export function openKPPanel() {
  // Block opening if no character card is loaded
  if (!hasCharacterCard()) {
    showToast('请先在下方选择或创建一个角色卡，再开始游戏');
    return;
  }
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
  document.dispatchEvent(new CustomEvent('render-game-saves'));
  if (!kpState.chatHistory.length) {
    const charName = document.getElementById('charName')?.value?.trim() || '调查员';
    addKPSystemMsg(`🎭 AI主持人已就绪。当前规则: ${THEME_NAMES[state.theme]}。角色 ${charName} 的冒险即将开始...`);
  }
  const input = document.getElementById('kpInput');
  if (input) setTimeout(() => input.focus(), 200);
}

export function closeKPPanel() {
  kpState.active = false;
  if (kpState.streamingAbort) { kpState.streamingAbort.abort(); kpState.streamingAbort = null; }
  kpState.streaming = false;
  const hero = document.getElementById('kpHero');
  const panel = document.getElementById('kpChatWrapper');
  if (hero) hero.style.display = '';
  if (panel) panel.style.display = 'none';
}

export function clearKPChat() {
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

// ── Quick Action ───────────────────────────────────
export function sendQuickAction(action) {
  const input = document.getElementById('kpInput');
  if (!input || kpState.streaming) return;
  input.value = action;
  sendKPMessage();
}

// ── Stop Streaming ─────────────────────────────────
export function stopKPStreaming() {
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

// ── API Core ──────────────────────────────────────
// Two API formats: Anthropic Messages API and Chat Completions API.
// Both go through the same fetch → SSE stream → accumulate text pipeline.

// Cached proxy detection: undefined=not checked, string=proxy URL, null=no proxy (direct call)
let _proxyBase = undefined;

async function detectProxy() {
  if (_proxyBase !== undefined) return _proxyBase;

  // 1) User-configured Cloudflare Worker proxy
  const workerUrl = localStorage.getItem('ttrpg-proxy-url');
  if (workerUrl) {
    try {
      const pingUrl = workerUrl.replace(/\/api\/proxy\/?$/, '/ping').replace(/\/$/, '') + '/ping';
      const resp = await fetch(pingUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        _proxyBase = workerUrl.replace(/\/$/, '') + '/api/proxy';
        return _proxyBase;
      }
    } catch {}
  }

  // 2) Local development server — only check on localhost to avoid 404 console noise on static hosts
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
    try {
      const resp = await fetch('/__ttrpg_ping__', { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (resp.ok && resp.headers.get('X-TTRPG-Server') === '1') {
        _proxyBase = '/api/proxy';
        return _proxyBase;
      }
    } catch {}
  }

  // 3) No proxy — call APIs directly (all major providers support CORS)
  _proxyBase = null;
  return null;
}

async function _stream(endpoint, reqHeaders, reqBody, controller, parseDelta) {
  const proxyBase = await detectProxy();

  let resp;
  if (proxyBase) {
    resp = await fetch(proxyBase, {
      method: 'POST',
      headers: { 'X-Proxy-Target': endpoint, 'Content-Type': 'application/json', ...reqHeaders },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
  } else {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...reqHeaders },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let text = '', buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const delta = parseDelta(JSON.parse(line.slice(6)));
        if (delta) {
          text += delta;
          if (kpState.chatHistory.length) kpState.chatHistory[kpState.chatHistory.length - 1].content = text;
          updateStreamingMsg(text);
        }
      } catch(e) { /* skip malformed SSE chunk */ }
    }
  }
  return text;
}

/** Anthropic Messages API — system as top-level field, x-api-key auth, SSE: delta.text */
async function _anthropic(cfg, systemPrompt, recentHistory, userMsg, controller) {
  const messages = [];
  for (const m of recentHistory) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMsg });

  return _stream(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
    { model: cfg.model, max_tokens: 4096, system: systemPrompt, messages, stream: true },
    controller,
    data => data.delta?.text || data.content_block?.text || ''
  );
}

/** Chat Completions API — system as first message, Bearer auth, SSE: choices[0].delta.content */
async function _chatCompletions(endpoint, cfg, systemPrompt, recentHistory, userMsg, controller) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of recentHistory) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMsg });

  return _stream(
    endpoint,
    { 'Authorization': `Bearer ${cfg.key}` },
    { model: cfg.model, max_tokens: 4096, messages, stream: true },
    controller,
    data => data.choices?.[0]?.delta?.content || ''
  );
}

// ── Provider Registry ─────────────────────────────
const _ENDPOINT = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  deepseek:  'https://api.deepseek.com/chat/completions',
  openai:    'https://api.openai.com/v1/chat/completions',
};

// ── Public API ────────────────────────────────────

/** Unified dispatch — preferred for all internal callers */
export async function callAPI(cfg, systemPrompt, recentHistory, userMsg, controller) {
  if (cfg.provider === 'anthropic') {
    return _anthropic(cfg, systemPrompt, recentHistory, userMsg, controller);
  }
  return _chatCompletions(
    _ENDPOINT[cfg.provider] || _ENDPOINT.openai,
    cfg, systemPrompt, recentHistory, userMsg, controller
  );
}

/** Backward compat — used by multiplayer/ modules */
export async function callAnthropicAPI(cfg, systemPrompt, recentHistory, userMsg, controller) {
  return _anthropic(cfg, systemPrompt, recentHistory, userMsg, controller);
}

export async function callOpenAIAPI(cfg, systemPrompt, recentHistory, userMsg, controller) {
  return _chatCompletions(
    _ENDPOINT[cfg.provider] || _ENDPOINT.openai,
    cfg, systemPrompt, recentHistory, userMsg, controller
  );
}

// ── Context Compression ────────────────────────────
async function compressContextAsync() {
  if (kpState._compressing) return;
  kpState._compressing = true;
  try {
    const total = kpState.apiHistory.length;
    if (total <= 50) return;
    const splitIdx = Math.floor(total * 0.55);
    const toCompress = kpState.apiHistory.slice(0, splitIdx);
    const toKeep = kpState.apiHistory.slice(splitIdx);
    const compressed = toCompress.map(m => (m.role === 'user' ? '玩家: ' : 'KP: ') + m.content).join('\n');
    const cfg = getKPConfig();
    if (!cfg.key) {
      kpState.apiHistory = kpState.apiHistory.slice(-60);
      return;
    }
    const summaryPrompt = '你是跑团会话压缩助手。请将以下跑团对话记录压缩为一段简明摘要（中文，500字以内），必须保留：关键剧情节点、重要NPC名称与行动、战斗结果、角色状态变化（SAN/HP/LUCK增减）、获得的线索与物品、当前未解决的悬念。格式自由，以叙述性文字呈现。\n\n' + compressed.substring(compressed.length - 6000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const summary = await callAPI(cfg, '你是游戏会话压缩助手。将跑团对话记录压缩为详细摘要，保留关键剧情、NPC行动、战斗结果和状态变化。', [], summaryPrompt, controller);
    clearTimeout(timeout);
    if (summary && summary.trim()) {
      const summaryEntry = { role: 'user', content: '[会话摘要] ' + summary.trim().substring(0, 2500) };
      kpState.apiHistory = [summaryEntry, ...toKeep];
    } else {
      kpState.apiHistory = kpState.apiHistory.slice(-60);
    }
  } catch (e) {
    kpState.apiHistory = kpState.apiHistory.slice(-60);
  } finally {
    kpState._compressing = false;
  }
}

// ── Character Card Validation ───────────────────────
export function hasCharacterCard() {
  const name = document.getElementById('charName')?.value?.trim();
  return !!name;
}

/** Render saved characters as selectable cards on the home page */
export function renderHomeCharSelect() {
  const list = document.getElementById('homeCharList');
  if (!list) return;
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const entries = Object.values(chars);
  if (!entries.length) {
    list.innerHTML = '<div class="char-select-empty">请先在"人物卡"页面创建角色，或点击上方按钮快速创建</div>';
    return;
  }
  const activeId = state.currentCharId;
  list.innerHTML = entries.map(c => `
    <div class="char-select-card${c.id === activeId ? ' selected' : ''}" data-action="kp:selectChar" data-id="${c.id}">
      <div class="char-select-dot"></div>
      <div class="char-select-info">
        <div class="char-select-name">${esc(c.name)}</div>
        <div class="char-select-meta">${esc(c.race||'?')} · ${esc(c.cls||'?')} · Lv.${c.level||1}</div>
      </div>
    </div>`).join('');
}

/** Handle character selection from home page */
export function selectHomeChar(id) {
  const chars = JSON.parse(localStorage.getItem('ttrpg-chars') || '{}');
  const c = chars[id];
  if (!c) return;
  // Load character into form fields (reuse loadCharData)
  import('./character.js').then(mod => {
    mod.loadCharData(c);
    state.currentCharId = id;
    renderHomeCharSelect();
    // Update the hero badge
    const badge = document.getElementById('kpHeroBadge');
    if (badge) badge.textContent = '✓ 角色已就绪 — 点击这里，开始冒险';
    showToast(`已选择角色: ${c.name}`);
  });
}

// ── Send Message ───────────────────────────────────
export async function sendKPMessage() {
  const input = document.getElementById('kpInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text || kpState.streaming) return;

  // Block game start without a character card
  if (!hasCharacterCard()) {
    showToast('请先在左侧创建角色卡（至少填写姓名）后再开始游戏');
    return;
  }

  input.value = '';
  input.disabled = true;

  const sendBtn = document.getElementById('kpSendBtn');
  const stopBtn = document.getElementById('kpStopBtn');
  if (sendBtn) sendBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = '';

  const cfg = getKPConfig();
  if (!cfg.key) {
    showToast('请先配置 API Key (点击上方的齿轮按钮)');
    if (sendBtn) sendBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
    input.disabled = false;
    return;
  }
  saveKPConfig(cfg);

  addKPMsg('player', text);
  renderKP();

  // Auto-roll dice
  const diceMatch = text.match(/(\d*d\d+[\+\-]?\d*)/gi);
  if (diceMatch) {
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
      kpState.chatHistory[kpState.chatHistory.length - 1].dice = results.join(', ');
      renderKP();
    }
  }

  const systemPrompt = buildSystemPrompt();
  const recentApi = kpState.apiHistory.slice(-80);

  addKPMsg('gm', '');
  kpState.streaming = true;
  renderKP();

  try {
    const controller = new AbortController();
    kpState.streamingAbort = controller;
    const fullResponse = await callAPI(cfg, systemPrompt, recentApi, text, controller);

    const displayText = stripAICommands(fullResponse);
    kpState.chatHistory[kpState.chatHistory.length - 1].content = displayText;

    const commands = parseAICommands(fullResponse);
    if (commands.length > 0) {
      const changes = applyAICommands(commands);
      if (changes.length > 0) {
        addKPSystemMsg(`角色状态已更新: ${changes.join('; ')}`);
        renderCocStatus();
        const data = getGameSaveData();
        localStorage.setItem('ttrpg-game-autosave', JSON.stringify(data));
      }
    }

    kpState.apiHistory.push({ role: 'user', content: text });
    kpState.apiHistory.push({ role: 'assistant', content: fullResponse });

    if (kpState.apiHistory.length > 70) {
      compressContextAsync();
    }
    if (kpState.apiHistory.length > 150) {
      kpState.apiHistory = kpState.apiHistory.slice(-120);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      kpState.chatHistory[kpState.chatHistory.length - 1].content += ' [已停止]';
    } else {
      let errMsg = err.message;
      if (errMsg === 'Failed to fetch' || err.name === 'TypeError') {
        errMsg = '网络连接失败 — 请检查网络，或刷新页面重试';
      } else if (errMsg.includes('HTTP 404')) {
        errMsg = 'API 端点返回 404 — 请检查模型是否与 API 提供商匹配';
      } else if (errMsg.includes('upstream api returned 404')) {
        errMsg = 'API 端点返回 404 — 请检查模型名称是否匹配当前 API 提供商';
      } else if (errMsg.includes('HTTP 405')) {
        errMsg = 'GitHub Pages 不支持 API 代理 — 已自动切换为直接调用，请刷新重试。如仍失败，请检查模型名称与 API 提供商是否匹配';
      } else if (errMsg.includes('HTTP 401') || errMsg.includes('HTTP 403')) {
        errMsg = 'API Key 无效或无权访问 — 请检查 KP 设置中的 API Key';
      } else if (errMsg.includes('HTTP 502') || errMsg.includes('proxy error')) {
        errMsg = '代理转发失败 — 请检查网络连接是否正常';
      }
      kpState.chatHistory[kpState.chatHistory.length - 1].content = `请求失败: ${errMsg}`;
      console.error('KP API error:', err);
    }
  } finally {
    kpState.streaming = false;
    kpState.streamingAbort = null;
    renderKP();
    if (input) input.disabled = false;
    const sb = document.getElementById('kpSendBtn');
    const st = document.getElementById('kpStopBtn');
    if (sb) sb.style.display = '';
    if (st) st.style.display = 'none';
  }
}

// ── Proxy Detection ────────────────────────────────
export async function checkProxyAvailable() {
  const base = await detectProxy();
  return base !== null;
}

// ── Listen for character list changes ──────────────────
document.addEventListener('char-list-changed', () => {
  renderHomeCharSelect();
  // Update hero badge if no character is currently loaded
  const badge = document.getElementById('kpHeroBadge');
  if (badge && !hasCharacterCard()) {
    badge.textContent = '选择角色后，点击这里开始冒险';
  }
});
