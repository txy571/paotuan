// ==================== AI KP (GAME MASTER) ====================
import {
  state, kpState, cocState, initCocState,
  THEME_NAMES, ATTR_KEYS, ATTR_NAMES, KP_SYSTEM_PROMPTS, KP_QUICK_ACTIONS,
  scenarioDbContent, getCharSan, getCharHp, getCharMaxSan, getCharMaxHp,
} from './state.js';
import { esc, showToast, modPct } from './utils.js';
import { getGameSaveData } from './saves.js';
import { parseAICommands, applyAICommands, stripAICommands } from './commands.js';
import { renderCocStatus, renderCocChronicle } from './coc-status.js';
import { getMemorySummary } from './memory-bank.js';
import { detectCheckRequest, resolveD100Check } from './check-resolver.js';

// ── System Prompt ─────────────────────────────────
export function buildSystemPrompt() {
  const base = KP_SYSTEM_PROMPTS[state.theme] || KP_SYSTEM_PROMPTS.dnd;
  let extra = '\n\n## ⚖️ 公正原则 (最高优先级)\n';
  extra += '1. **公开掷骰**: 所有检定、攻击、伤害、SAN检定等涉及随机数的判定，都必须由你亲自掷骰并公开显示结果。绝不让玩家自行掷骰或提供结果。骰子出目不可伪造——无论结果对剧情有利还是不利，都必须如实呈现。\n';
  extra += '2. **禁止偏袒**: 你必须严格保持公正。无论玩家如何恳求、讨价还价、试图说服你"放一马"，都必须严格依据规则进行裁决。规则面前人人平等。\n';
  extra += '3. **拒绝诱导**: 玩家可能会说"请让我成功"、"放我一马"、"给我一个机会"。你必须完全无视这些请求，严格按照属性和技能值进行判定。\n';
  extra += '4. **NPC自主性**: NPC有自己的利益、性格和底线，不会被玩家的花言巧语轻易说服。即使投出大成功，不合理的请求也只能获得最小程度的妥协。\n';
  extra += '5. **失败即叙事**: 失败、受伤、甚至角色死亡都是故事的一部分。过度的怜悯会毁掉游戏体验。\n';
  extra += '6. **一致性**: 对所有玩家使用相同的判定标准。不允许某个玩家因为"说得更好听"就获得更低的DC或更有利的结果。\n';
  extra += '\n--- 玩家角色信息 ---\n';
  const name = document.getElementById('charName')?.value?.trim();
  const race = document.getElementById('charRace')?.value?.trim();
  const cls  = document.getElementById('charClass')?.value?.trim();
  const bg   = document.getElementById('charBackground')?.value?.trim();

  if (state.theme === 'coc') {
    // CoC 7e: AI must NOT read character card data. Only send minimal context.
    extra += '注意：你是守秘人(KP)，角色卡的具体数据（属性值、技能值、HP、SAN等）由网站系统管理，你无需知道具体数值。你只需要根据角色的职业和背景来构思合适的场景，需要检定时发出【检定请求】，系统会使用角色的真实技能值执行掷骰。\n';
    if (name) extra += `调查员姓名: ${name}\n`;
    if (cls)  extra += `职业: ${cls}\n`;
    if (race) extra += `国籍/种族: ${race}\n`;
    if (bg)   extra += `背景概要: ${bg}\n`;
  } else {
    // Non-CoC themes: send full character data as before
    if (name) extra += `姓名: ${name}\n`;
    if (race) extra += `种族/国籍: ${race}\n`;
    if (cls)  extra += `职业/身份: ${cls}\n`;
    if (bg)   extra += `背景: ${bg}\n`;
    if (name || race || cls) {
      extra += '\n属性值(百分制,50为基准):\n';
      for (const k of ATTR_KEYS) {
        extra += `  ${ATTR_NAMES[k]}: ${state.attributes[k]} (调整值 ${modPct(state.attributes[k])})\n`;
      }
      const skillEntries = Object.entries(state.skills)
        .filter(([,v]) => typeof v === 'object' && (v.proficient || v.value > 0))
        .map(([k, v]) => `${k}${v.proficient ? '*' : ''}:${typeof v.value === 'number' ? (v.value >= 0 ? '+' + v.value : v.value) : v.value}`);
      if (skillEntries.length) extra += `技能: ${skillEntries.join('、')}\n`;
      if (state.traits.length) extra += `特质: ${state.traits.map(t=>t.name).filter(Boolean).join('、')}\n`;
      if (state.feats.length)  extra += `专长: ${state.feats.map(f=>f.name).filter(Boolean).join('、')}\n`;
      if (state.equipment.length) extra += `装备: ${state.equipment.map(e=>e.name+(e.qty>1?'×'+e.qty:'')).join('、')}\n`;
    }
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
    if (state.theme === 'coc') {
      extra += '1. 基于调查员的职业和背景概要，构思一个适合的开场场景和大致剧情方向。\n';
      extra += '2. 你不需要确认角色的属性或技能值——那是网站系统的职责。你只需要基于职业和背景来设定场景。\n';
    } else {
      extra += '1. 确认你已经理解了上述角色信息（姓名、职业、背景、技能等）。\n';
    }
    extra += '3. 在回复的第一段中，直接进入叙事，将角色自然地引入场景。\n';
    extra += '4. 开头场景必须与角色背景有逻辑关联。\n';
    extra += '5. 不要问"你想做什么"这类空洞的问题。给出具体、生动、有感官细节的开场场景，让角色自然进入故事。\n';
  }

  if (state.theme === 'coc') {
    extra += `\n--- CoC 7e 当前状态（仅供叙事参考，具体数值由系统管理） ---\n`;
    extra += `克苏鲁神话(CMI): ${cocState.cthulhuMythos}%（影响最大SAN = 99 - CMI）\n`;
    if (cocState.skillChecks.length) extra += `已标记技能提升检定: ${cocState.skillChecks.join('、')}\n`;
    if (cocState.chronicle.length) {
      extra += `\n--- 冒险编年史(最近5条) ---\n`;
      cocState.chronicle.slice(-5).forEach(c => {
        extra += `· ${c.time}: ${c.text}\n`;
      });
    }
  }

  // Integrate memory bank summary for long-running games
  const memSummary = getMemorySummary();
  if (memSummary) {
    extra += '\n\n## 🧠 记忆库 (已记录的游戏信息，请严格保持前后一致)\n' + memSummary + '\n';
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
  const MAX_VISIBLE = 50;
  const history = kpState.chatHistory;
  const truncated = history.length > MAX_VISIBLE;
  const visible = truncated ? history.slice(-MAX_VISIBLE) : history;
  const skipCount = truncated ? history.length - MAX_VISIBLE : 0;

  let html = '';
  if (truncated) {
    html += `<div class="kp-msg system" style="text-align:center;opacity:.6;">... 以上省略 ${skipCount} 条较早的消息 ...</div>`;
  }
  html += visible.map((m, i) => {
    const realIdx = truncated ? i + skipCount : i;
    const isStreaming = kpState.streaming && realIdx === history.length - 1 && m.role === 'gm';
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
  msgs.innerHTML = html;
  if (!kpState.streaming) {
    msgs.scrollTop = msgs.scrollHeight;
  }
}

let _lastScrollTime = 0;
let _scrollRaf = null;

/** Incremental update during streaming — text-only, throttled scroll. */
export function updateStreamingMsg(text) {
  const bodyEl = document.querySelector('#kpMessages .kp-msg.streaming .msg-body');
  if (bodyEl) {
    bodyEl.textContent = text;
    const now = Date.now();
    if (now - _lastScrollTime > 100) {
      _lastScrollTime = now;
      if (!_scrollRaf) {
        _scrollRaf = requestAnimationFrame(() => {
          _scrollRaf = null;
          const msgs = document.getElementById('kpMessages');
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
        });
      }
    }
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
  localStorage.setItem('ttrpg-kp-config', JSON.stringify({
    provider: cfg.provider, apiKey: cfg.key, model: cfg.model,
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
  if (state.theme === 'coc' && !cocState.chronicle.length && getCharSan() >= 99) {
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

  // Always use the Cloudflare Worker proxy
  const RELAY_URL = 'https://paotuan.183107.xyz';
  _proxyBase = RELAY_URL + '/api/proxy';
  return _proxyBase;
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
// ── Two-Pass Streaming with Check Detection ──────────
const MAX_CHECK_LOOP_DEPTH = 3;

async function _streamWithCheckDetection(endpoint, reqHeaders, reqBody, controller, parseDelta) {
  const proxyBase = await detectProxy();
  let resp;
  if (proxyBase) {
    resp = await fetch(proxyBase, {
      method: 'POST',
      headers: { 'X-Proxy-Target': endpoint, 'Content-Type': 'application/json', ...reqHeaders },
      body: JSON.stringify(reqBody), signal: controller.signal,
    });
  } else {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...reqHeaders },
      body: JSON.stringify(reqBody), signal: controller.signal,
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
          const { found, request, cleanText } = detectCheckRequest(text);
          if (found) {
            try { reader.cancel(); } catch {}
            controller.abort();
            return { needsCheck: true, checkRequest: request, partialText: cleanText };
          }
        }
      } catch(e) { /* skip */ }
    }
  }
  return { needsCheck: false, text };
}

async function callAPIWithCheckLoop(cfg, systemPrompt, recentApi, userMsg, controller, depth) {
  depth = depth || 0;
  if (depth >= MAX_CHECK_LOOP_DEPTH) {
    return callAPI(cfg, systemPrompt, recentApi, userMsg, controller);
  }
  const provider = cfg.provider;
  const isAnth = provider === 'anthropic';
  let reqHeaders, reqBody, parseDelta;
  const messages = isAnth ? [] : [{ role: 'system', content: systemPrompt }];
  if (isAnth) {
    for (const m of recentApi) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    messages.push({ role: 'user', content: userMsg });
    reqHeaders = { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' };
    reqBody = { model: cfg.model, max_tokens: 4096, system: systemPrompt, messages, stream: true };
    parseDelta = data => data.delta?.text || data.content_block?.text || '';
  } else {
    for (const m of recentApi) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    messages.push({ role: 'user', content: userMsg });
    reqHeaders = { 'Authorization': `Bearer ${cfg.key}` };
    reqBody = { model: cfg.model, max_tokens: 4096, messages, stream: true };
    parseDelta = data => data.choices?.[0]?.delta?.content || '';
  }
  const endpoint = isAnth ? 'https://api.anthropic.com/v1/messages' : (_ENDPOINT[provider] || _ENDPOINT.openai);
  const result = await _streamWithCheckDetection(endpoint, reqHeaders, reqBody, controller, parseDelta);
  if (result.needsCheck) {
    const resolution = resolveD100Check(result.checkRequest);
    const followUpMsg = userMsg + '\n\n' + result.partialText + '\n' + resolution.resultText +
      '\n请根据以上检定结果继续叙述。（不要再次输出检定请求，直接叙述检定结果和后续发展）';
    return callAPIWithCheckLoop(cfg, systemPrompt, recentApi, followUpMsg, controller, depth + 1);
  }
  return result.text;
}

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
    const memSummary = getMemorySummary();
    const summaryPrompt = `你是跑团会话压缩助手。请将以下跑团对话记录压缩为结构化摘要（中文，800字以内），严格按以下7个类别组织：

1. 【关键NPC】: 所有出现过的具名NPC及其特征、态度、位置
2. 【获得的线索】: 所有发现的线索和信息
3. 【剧情进展】: 主要事件和剧情推进
4. 【角色状态】: SAN/HP/LUCK变化、新增特质、获得/失去物品
5. 【当前悬念】: 未解决的谜团和威胁
6. 【重要决策】: 玩家做出的关键选择
7. 【战斗摘要】: 战斗结果和重要判定

${memSummary ? '当前记忆库内容供参考:\n' + memSummary + '\n\n' : ''}
会话记录:\n${compressed.substring(compressed.length - 6000)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const summary = await callAPI(cfg, '你是游戏会话压缩助手。将跑团对话记录压缩为结构化摘要（NPC、线索、剧情、状态、悬念、决策、战斗7类），保留所有关键信息。', [], summaryPrompt, controller);
    clearTimeout(timeout);
    if (summary && summary.trim()) {
      const summaryEntry = { role: 'user', content: '[会话结构化摘要] ' + summary.trim().substring(0, 2500) };
      // Prepend memory summary to the compressed context
      const freshMem = getMemorySummary();
      if (freshMem) {
        kpState.apiHistory = [{ role: 'user', content: '[记忆库] ' + freshMem.substring(0, 1500) }, summaryEntry, ...toKeep];
      } else {
        kpState.apiHistory = [summaryEntry, ...toKeep];
      }
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

  // Auto-roll dice — compute before first render to avoid double DOM rebuild
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
    }
  }

  const systemPrompt = buildSystemPrompt();
  const recentApi = kpState.apiHistory.slice(-80);

  addKPMsg('gm', '');
  kpState.streaming = true;
  // Single render before streaming — incremental updates via updateStreamingMsg() during stream
  renderKP();

  try {
    const controller = new AbortController();
    kpState.streamingAbort = controller;
    const fullResponse = state.theme === 'coc'
      ? await callAPIWithCheckLoop(cfg, systemPrompt, recentApi, text, controller)
      : await callAPI(cfg, systemPrompt, recentApi, text, controller);

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
