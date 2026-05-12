// ==================== STRUCTURED MEMORY BANK ====================
// Persists NPCs, clues, plot threads, locations across sessions.
// Also tracks foreshadowing, player decisions, and NPC personality traits.
// The AI KP can update this via memory commands.
// localStorage key: 'ttrpg-memory-bank'

const STORAGE_KEY = 'ttrpg-memory-bank';

export const memoryBank = {
  npcs: [],          // { name, description, location, attitude, firstMet, lastSeen, notes, personality:{speech,quirk,secret,goal} }
  clues: [],         // { id, description, source, discovered, relatedNPCs, revealed }
  plotThreads: [],   // { id, title, status:'open'|'resolved'|'abandoned', summary, keyEvents }
  locations: [],     // { name, description, knownNPCs, keyFeatures }
  foreshadowing: [], // { id, hint, plantedAt, plantContext, payOff, relatedThread, relatedNPC }
  decisions: [],     // { id, description, madeBy, consequence, timestamp, threadId }
  sessionLog: [],    // [{ time, type:'event'|'clue'|'npc'|'combat'|'decision', summary }]
  lastUpdated: null,
};

// ── Persistence ─────────────────────────────────
export function initMemoryBank() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      memoryBank.npcs = saved.npcs || [];
      memoryBank.clues = saved.clues || [];
      memoryBank.plotThreads = saved.plotThreads || [];
      memoryBank.locations = saved.locations || [];
      memoryBank.foreshadowing = saved.foreshadowing || [];
      memoryBank.decisions = saved.decisions || [];
      memoryBank.sessionLog = saved.sessionLog || [];
      memoryBank.lastUpdated = saved.lastUpdated || null;
    }
  } catch(e) { /* ignore corrupt data */ }
}

export function saveMemoryBank() {
  try {
    memoryBank.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      npcs: memoryBank.npcs.slice(-80),
      clues: memoryBank.clues.slice(-100),
      plotThreads: memoryBank.plotThreads.slice(-50),
      locations: memoryBank.locations.slice(-40),
      foreshadowing: memoryBank.foreshadowing.slice(-30),
      decisions: memoryBank.decisions.slice(-50),
      sessionLog: memoryBank.sessionLog.slice(-200),
      lastUpdated: memoryBank.lastUpdated,
    }));
  } catch(e) { /* quota exceeded or other error */ }
}

export function clearMemoryBank() {
  memoryBank.npcs = [];
  memoryBank.clues = [];
  memoryBank.plotThreads = [];
  memoryBank.locations = [];
  memoryBank.foreshadowing = [];
  memoryBank.decisions = [];
  memoryBank.sessionLog = [];
  memoryBank.lastUpdated = null;
  saveMemoryBank();
}

// ── CRUD ────────────────────────────────────────
export function addNPC(npc) {
  const existing = memoryBank.npcs.find(n => n.name === npc.name);
  if (existing) {
    Object.assign(existing, npc, { lastSeen: new Date().toLocaleString() });
    // Merge personality traits without overwriting
    if (npc.personality) {
      existing.personality = { ...(existing.personality || {}), ...npc.personality };
    }
  } else {
    memoryBank.npcs.push({
      ...npc,
      firstMet: new Date().toLocaleString(),
      lastSeen: new Date().toLocaleString(),
      notes: npc.notes || '',
      personality: npc.personality || {},
    });
  }
  memoryBank.sessionLog.push({ time: new Date().toLocaleString(), type: 'npc', summary: `NPC ${npc.name}: ${npc.description || '出现'}` });
  saveMemoryBank();
}

export function addClue(clue) {
  const id = 'clue_' + Date.now();
  memoryBank.clues.push({ id, description: clue, source: '', discovered: new Date().toLocaleString(), relatedNPCs: [], revealed: false });
  memoryBank.sessionLog.push({ time: new Date().toLocaleString(), type: 'clue', summary: `线索: ${clue}` });
  saveMemoryBank();
}

export function revealClue(id, source) {
  const c = memoryBank.clues.find(c => c.id === id);
  if (c) { c.revealed = true; if (source) c.source = source; saveMemoryBank(); }
}

export function addPlotThread(title, status, summary) {
  const id = 'plot_' + Date.now();
  memoryBank.plotThreads.push({ id, title, status: status || 'open', summary: summary || '', keyEvents: [] });
  memoryBank.sessionLog.push({ time: new Date().toLocaleString(), type: 'event', summary: `剧情: [${title}] - ${summary}` });
  saveMemoryBank();
}

export function updatePlotThread(id, update) {
  const p = memoryBank.plotThreads.find(p => p.id === id);
  if (p) {
    if (update.status) p.status = update.status;
    if (update.summary) p.summary = update.summary;
    if (update.event) p.keyEvents.push({ time: new Date().toLocaleString(), text: update.event });
    saveMemoryBank();
  }
}

export function addLocation(loc) {
  const existing = memoryBank.locations.find(l => l.name === loc.name);
  if (existing) {
    if (loc.description) existing.description = loc.description;
    if (loc.keyFeatures) existing.keyFeatures = [...new Set([...(existing.keyFeatures||[]), ...loc.keyFeatures])];
  } else {
    memoryBank.locations.push({ name: loc.name, description: loc.description || '', knownNPCs: [], keyFeatures: loc.keyFeatures || [] });
  }
  saveMemoryBank();
}

// ── Foreshadowing (伏笔) ─────────────────────────
export function addForeshadowing(hint, context, relatedThread, relatedNPC) {
  const id = 'fsh_' + Date.now();
  memoryBank.foreshadowing.push({
    id, hint, plantedAt: new Date().toLocaleString(), plantContext: context || '',
    payOff: '', relatedThread: relatedThread || '', relatedNPC: relatedNPC || '',
  });
  saveMemoryBank();
}

export function payOffForeshadowing(id, payoff) {
  const f = memoryBank.foreshadowing.find(f => f.id === id);
  if (f) { f.payOff = payoff; saveMemoryBank(); }
}

// ── Player Decisions ─────────────────────────────
export function recordDecision(description, consequence, threadId) {
  const id = 'dec_' + Date.now();
  memoryBank.decisions.push({
    id, description, madeBy: '玩家', consequence: consequence || '',
    timestamp: new Date().toLocaleString(), threadId: threadId || '',
  });
  memoryBank.sessionLog.push({ time: new Date().toLocaleString(), type: 'decision', summary: `选择: ${description}` });
  saveMemoryBank();
}

// ── Queries ─────────────────────────────────────
export function getActiveThreads() {
  return memoryBank.plotThreads.filter(p => p.status === 'open');
}

export function getUnrevealedClues() {
  return memoryBank.clues.filter(c => !c.revealed);
}

export function getUnpaidForeshadowing() {
  return memoryBank.foreshadowing.filter(f => !f.payOff);
}

export function getRecentDecisions() {
  return memoryBank.decisions.slice(-10);
}

export function getRelevantNPCs(query) {
  if (!query) return memoryBank.npcs.slice(-10);
  const q = query.toLowerCase();
  return memoryBank.npcs.filter(n =>
    n.name.toLowerCase().includes(q) ||
    (n.description || '').toLowerCase().includes(q) ||
    (n.location || '').toLowerCase().includes(q)
  );
}

// ── Summary for AI Context ──────────────────────
export function getMemorySummary() {
  const parts = [];
  const activeThreads = getActiveThreads();
  const unrevealedClues = getUnrevealedClues();
  const recentNPCs = memoryBank.npcs.slice(-15);
  const unpaidForeshadowing = getUnpaidForeshadowing();
  const recentDecisions = getRecentDecisions();

  if (activeThreads.length) {
    parts.push('【进行中的剧情线程】');
    activeThreads.forEach(p => parts.push(`· ${p.title}: ${p.summary}`));
  }
  if (unpaidForeshadowing.length) {
    parts.push('【已埋下的伏笔（等待回收）】');
    unpaidForeshadowing.slice(-8).forEach(f =>
      parts.push(`· ${f.hint.substring(0, 80)} [${f.plantedAt}]${f.relatedThread ? ' → ' + f.relatedThread : ''}`)
    );
  }
  if (unrevealedClues.length) {
    parts.push('【未揭示的线索】(' + unrevealedClues.length + '条)');
    unrevealedClues.slice(-8).forEach(c => parts.push(`· ${c.description.substring(0, 80)}`));
  }
  if (recentNPCs.length) {
    parts.push('【已知NPC档案】');
    recentNPCs.forEach(n => {
      const pers = n.personality || {};
      const traits = [];
      if (pers.speech) traits.push(`口癖:${pers.speech}`);
      if (pers.quirk) traits.push(`习惯:${pers.quirk}`);
      if (pers.secret) traits.push(`秘密:${pers.secret}`);
      if (pers.goal) traits.push(`目标:${pers.goal}`);
      parts.push(`· ${n.name}${n.location?' ('+n.location+')':''}: ${(n.description||'').substring(0,60)}${n.attitude?' ['+n.attitude+']':''}${traits.length ? ' | ' + traits.join(' ') : ''}`);
    });
  }
  if (recentDecisions.length) {
    parts.push('【玩家重要决策】');
    recentDecisions.forEach(d => parts.push(`· ${d.timestamp}: ${d.description}${d.consequence ? ' → ' + d.consequence : ''}`));
  }
  if (memoryBank.locations.length) {
    parts.push('【已知地点】');
    memoryBank.locations.slice(-8).forEach(l => parts.push(`· ${l.name}: ${(l.description||'').substring(0,80)}`));
  }
  return parts.length > 1 ? parts.join('\n') : '';
}

// ── NPC Personality Profile for Compression ─────
export function getNPCProfiles() {
  if (!memoryBank.npcs.length) return '';
  const lines = ['【NPC人物档案——压缩时必须保留】'];
  memoryBank.npcs.slice(-20).forEach(n => {
    const pers = n.personality || {};
    lines.push(`· ${n.name}: ${n.description||''} | 位置:${n.location||'?'} | 态度:${n.attitude||'?'} | 初见:${n.firstMet||'?'}`);
    if (pers.speech || pers.quirk || pers.secret || pers.goal) {
      lines.push(`  个性: ${[pers.speech ? '口癖:'+pers.speech : '', pers.quirk ? '习惯:'+pers.quirk : '', pers.secret ? '秘密:'+pers.secret : '', pers.goal ? '动机:'+pers.goal : ''].filter(Boolean).join(' | ')}`);
    }
  });
  return lines.join('\n');
}

// ── Import from AI command ──────────────────────
export function applyMemoryCommand(type, value) {
  try {
    switch (type) {
      case 'NPC': {
        const parts = value.split(/[：:]/);
        addNPC({
          name: (parts[0] || '').trim(),
          description: (parts[1] || '').trim(),
          location: (parts[2] || '').trim(),
          attitude: (parts[3] || '').trim(),
          // Extended: if more parts exist, parse as personality traits
          personality: parts.length > 4 ? {
            speech: (parts[4] || '').trim(),
            quirk: (parts[5] || '').trim(),
            secret: (parts[6] || '').trim(),
            goal: (parts[7] || '').trim(),
          } : {},
        });
        return `NPC已记录: ${parts[0]}`;
      }
      case 'CLUE': {
        addClue(value.trim());
        return '线索已记录';
      }
      case 'PLOT': {
        const parts = value.split(/[：:]/);
        addPlotThread(
          (parts[0] || '').trim(),
          (parts[1] || 'open').trim(),
          (parts[2] || '').trim()
        );
        return `剧情已记录: ${parts[0]}`;
      }
      case 'MEMORY': {
        const parts = value.split(/[：:]/);
        memoryBank.sessionLog.push({
          time: new Date().toLocaleString(),
          type: 'event',
          summary: `${parts[0]}: ${(parts[1]||'').trim()}`
        });
        saveMemoryBank();
        return `记忆已记录: ${parts[0]}`;
      }
      default: return null;
    }
  } catch(e) {
    console.warn('Memory command error:', type, value, e);
    return null;
  }
}
