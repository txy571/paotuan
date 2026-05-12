---
name: TTS voice output feature
description: MIMO TTS API integration for streaming AI voice output
type: project
---

## TTS (Text-to-Speech) Feature

Implemented 2026-05-12.

- **Engine**: `public/js/tts.js` — MIMO TTS API client, smart punctuation-based sentence segmentation, pre-synthesis with concurrent request limiting (max 2), sequential audio playback queue
- **API Endpoint**: `https://api.xiaomimimo.com/v1/chat/completions` (direct call, not through Cloudflare proxy)
- **Voice options**: `mimo_default` (natural), `default_zh` (clear female)
- **Segmentation**: Splits on Chinese/English punctuation (。；？！!?，、,.：;), processes remaining buffer at stream end

### Integration Points:
- `kp.js` `_stream()` — calls `tts.streamBegin()` before read loop, `tts.feedChunk(delta)` for each SSE delta, `tts.flush()` after stream ends
- `kp.js` `stopKPStreaming()` — calls `tts.stop()` on abort
- `kp.js` `clearKPChat()` — calls `tts.stop()` on clear
- `init.js` — TTS toggle/save/stop action handlers, periodic UI updates every 500ms
- `HomeSection.astro` — KP config panel has TTS section (MIMO API key, voice select), panel header has toggle button (`data-action="tts:toggle"`), TTS status controls (auto-stop checkbox, stop button)
- `AboutSection.astro` — TTS in advanced features, MIMO API in config list, TTS quick start step
- `README.md` — TTS in AI features, usage guide, highlights

### Controls:
- 🔇/🔊 toggle button in KP panel header
- Auto-stop checkbox: stop voice after text output completes (default: on)
- Stop button when TTS is playing
- "播完静音" = auto-stop on

### Why direct API call (not proxy):
MIMO TTS is a different provider endpoint not in the proxy whitelist. Synthesized audio is returned as base64 in the JSON response, not SSE streamed.
