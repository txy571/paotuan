// ==================== TTS Engine — MIMO TTS API + Smart Streaming Playback ====================
// Exports: tts (singleton object with feedChunk, flush, stop, reset, and state getters/setters)

const DEFAULT_VOICE = 'mimo_default';

// ── State (managed alongside the singleton) ──
let _enabled = false;
let _autoStop = true;
let _mimoApiKey = '';
let _mimoVoice = DEFAULT_VOICE;

// ── Internal engine state ──
let _buffer = '';                        // incomplete-sentence buffer
let _sentences = [];                     // [{ index, text, audioBuffer }]
let _playbackQueue = [];                 // sentence indices ordered for playback
let _isPlaying = false;
let _currentIndex = -1;
let _nextSentenceIndex = 1;
let _isStopped = false;
let _streamActive = false;               // true while AI is still producing text
let _audioCtx = null;
let _currentSource = null;
let _activeSynthesis = 0;
const MAX_CONCURRENT_SYNTH = 2;
let _synthesisPending = [];

// ── LocalStorage keys ──
const LS_TTS_CONFIG = 'ttrpg-tts-config';

// ── Private helpers ──

function _getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _isPunct(ch) {
  return /^[。；？！!?，、,.：;]$/.test(ch);
}

/** Find the last punctuation position in a string */
function _lastPunctPos(s) {
  for (let i = s.length - 1; i >= 0; i--) {
    if (_isPunct(s[i])) return i;
  }
  return -1;
}

// ── MIMO TTS API call ──
async function _synthesize(sentence, index) {
  if (!_mimoApiKey) throw new Error('MIMO API Key 未配置');
  const payload = {
    model: 'mimo-v2-tts',
    messages: [
      { role: 'user', content: '快速朗读文本' },
      { role: 'assistant', content: `<style>特别快 非常快 极速</style>${sentence}` }
    ],
    audio: {
      format: 'wav',
      voice: _mimoVoice,
    },
    stream: false
  };

  const resp = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': _mimoApiKey
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`TTS API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) throw new Error('音频数据缺失');

  const binaryStr = atob(audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const ab = await blob.arrayBuffer();
  return await _getAudioCtx().decodeAudioData(ab);
}

async function _scheduleSynth(text, index) {
  if (_isStopped) return;
  const run = async () => {
    _activeSynthesis++;
    try {
      const buf = await _synthesize(text, index);
      if (_isStopped) return;
      const found = _sentences.find(s => s.index === index);
      if (found) found.audioBuffer = buf;
      _tryPlay();
    } catch (e) {
      // Mark sentence as failed (null audio) so playback skips it
      const found = _sentences.find(s => s.index === index);
      if (found) found.audioBuffer = null;
    } finally {
      _activeSynthesis--;
      if (_synthesisPending.length && !_isStopped) {
        const next = _synthesisPending.shift();
        _scheduleSynth(next.text, next.index);
      }
    }
  };

  if (_activeSynthesis >= MAX_CONCURRENT_SYNTH) {
    _synthesisPending.push({ text, index });
  } else {
    run();
  }
}

function _addSentence(text) {
  if (_isStopped) return;
  const index = _nextSentenceIndex++;
  _sentences.push({ index, text, audioBuffer: null });
  _playbackQueue.push(index);
  _scheduleSynth(text, index);
  if (!_isPlaying) _tryPlay();
}

function _tryPlay() {
  if (_isStopped || _isPlaying) return;

  // Find first sentence in queue that has audio ready
  let playIdx = -1;
  let queuePos = -1;
  for (let i = 0; i < _playbackQueue.length; i++) {
    const idx = _playbackQueue[i];
    const s = _sentences.find(s => s.index === idx);
    if (s && s.audioBuffer) {
      playIdx = idx;
      queuePos = i;
      break;
    }
  }

  if (playIdx === -1) {
    // Nothing ready — if stream is done and all sentences have been processed
    if (!_streamActive && _sentences.length > 0 && _sentences.every(s => s.audioBuffer !== undefined)) {
      _onAllDone();
    }
    return;
  }

  _playbackQueue.splice(queuePos, 1);
  const sentence = _sentences.find(s => s.index === playIdx);
  if (!sentence || !sentence.audioBuffer) { _tryPlay(); return; }

  _isPlaying = true;
  _currentIndex = playIdx;

  try {
    const ctx = _getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = sentence.audioBuffer;
    source.connect(ctx.destination);
    _currentSource = source;

    source.onended = () => {
      _isPlaying = false;
      _currentIndex = -1;
      _currentSource = null;
      // After playback, check if we should auto-stop
      if (_autoStop && !_streamActive && _playbackQueue.length === 0) {
        // All done, auto-stop
        return;
      }
      _tryPlay();
    };

    source.start();
  } catch (e) {
    _isPlaying = false;
    _currentIndex = -1;
    _currentSource = null;
    _tryPlay();
  }
}

function _onAllDone() {
  // All sentences synthesized and played — no op by default
}

// ── Public API ──

export const tts = {
  /** Whether TTS output is globally enabled */
  get enabled() { return _enabled; },
  set enabled(v) { _enabled = !!v; },

  /** Whether to auto-stop (no more playback) after current stream finishes */
  get autoStop() { return _autoStop; },
  set autoStop(v) { _autoStop = !!v; },

  get mimoApiKey() { return _mimoApiKey; },
  set mimoApiKey(v) { _mimoApiKey = v || ''; },

  get mimoVoice() { return _mimoVoice; },
  set mimoVoice(v) { _mimoVoice = v || DEFAULT_VOICE; },

  get isPlaying() { return _isPlaying; },
  get streamActive() { return _streamActive; },
  get pendingCount() { return _playbackQueue.length + _sentences.filter(s => !s.audioBuffer).length; },

  /** Load persisted config from localStorage */
  loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_TTS_CONFIG) || '{}');
      if (saved.enabled !== undefined) _enabled = !!saved.enabled;
      if (saved.autoStop !== undefined) _autoStop = !!saved.autoStop;
      if (saved.mimoApiKey) _mimoApiKey = saved.mimoApiKey;
      if (saved.mimoVoice) _mimoVoice = saved.mimoVoice;
    } catch (e) { /* ignore */ }
  },

  /** Save current config to localStorage */
  saveConfig() {
    localStorage.setItem(LS_TTS_CONFIG, JSON.stringify({
      enabled: _enabled,
      autoStop: _autoStop,
      mimoApiKey: _mimoApiKey,
      mimoVoice: _mimoVoice,
    }));
  },

  /** Sync config from DOM inputs (called before save) */
  syncFromUI() {
    const keyEl = document.getElementById('ttsMimoApiKey');
    const voiceEl = document.getElementById('ttsVoiceSelect');
    const enabledEl = document.getElementById('ttsEnabled');
    const autoStopEl = document.getElementById('ttsAutoStop');
    if (keyEl) _mimoApiKey = keyEl.value.trim();
    if (voiceEl) _mimoVoice = voiceEl.value;
    if (enabledEl) _enabled = enabledEl.checked;
    if (autoStopEl) _autoStop = autoStopEl.checked;
  },

  /** Push config to DOM inputs */
  syncToUI() {
    const keyEl = document.getElementById('ttsMimoApiKey');
    const voiceEl = document.getElementById('ttsVoiceSelect');
    const enabledEl = document.getElementById('ttsEnabled');
    const autoStopEl = document.getElementById('ttsAutoStop');
    if (keyEl) keyEl.value = _mimoApiKey;
    if (voiceEl) voiceEl.value = _mimoVoice;
    if (enabledEl) enabledEl.checked = _enabled;
    if (autoStopEl) autoStopEl.checked = _autoStop;
  },

  /** Announce the start of streaming — call before first feedChunk */
  streamBegin() {
    if (!_enabled) return;
    // Reset buffer and queues for a clean start (handles re-stream on retry)
    _buffer = '';
    _isStopped = false;
    _streamActive = true;
    _sentences = [];
    _playbackQueue = [];
    _isPlaying = false;
    _currentIndex = -1;
    _nextSentenceIndex = 1;
    _activeSynthesis = 0;
    _synthesisPending = [];
    if (_currentSource) {
      try { _currentSource.stop(); } catch(e) {}
      _currentSource = null;
    }
  },

  /** Feed a text chunk from the streaming response */
  feedChunk(chunk) {
    if (!_enabled || _isStopped || !_streamActive) return;
    _buffer += chunk;

    // Find the last punctuation position and split
    const punctPos = _lastPunctPos(_buffer);
    if (punctPos >= 0) {
      const sentence = _buffer.substring(0, punctPos + 1).trim();
      _buffer = _buffer.substring(punctPos + 1);
      if (sentence) _addSentence(sentence);
    }
  },

  /** Mark streaming complete — flush remaining buffer, then set _streamActive = false */
  flush() {
    if (!_enabled || _isStopped) return;
    const remaining = _buffer.trim();
    if (remaining) {
      _addSentence(remaining);
      _buffer = '';
    }
    _streamActive = false;

    // If autoStop is enabled, stop after flushing remaining text
    if (_autoStop && !_isPlaying && _playbackQueue.length === 0) {
      // Nothing playing and nothing queued — silent stop
    }
  },

  /** Stop all playback and clear queues */
  stop() {
    _isStopped = true;
    _streamActive = false;
    if (_currentSource) {
      try { _currentSource.stop(); } catch (e) { /* ignore */ }
      _currentSource = null;
    }
    if (_audioCtx) {
      _audioCtx.close().catch(() => {});
      _audioCtx = null;
    }
    _isPlaying = false;
    _currentIndex = -1;
    _sentences = [];
    _playbackQueue = [];
    _buffer = '';
    _activeSynthesis = 0;
    _synthesisPending = [];
    _nextSentenceIndex = 1;
  },

  /** Full reset (unlike stop, also resets streamActive flag for reuse) */
  reset() {
    this.stop();
    _isStopped = false;
  },

  /** Resume AudioContext on user interaction (call from click handlers) */
  ensureAudioCtx() {
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
  },
};
