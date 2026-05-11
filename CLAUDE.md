# CLAUDE.md — 跑团助手 (TTRPG Companion)

A zero-dependency, single-page TTRPG companion app. Supports solo play with an AI game master (KP/DM) and multiplayer via Cloudflare Workers WebSocket relay.

## Project Overview

- **Type**: Pure frontend SPA + Cloudflare Worker backend
- **Entry point**: `index.html` → loads `js/app.js` (sole ES module) → delegates to `js/init.js`
- **Languages**: JavaScript ES Modules, HTML5, CSS3, Node.js (local server only)
- **No bundler, no framework, no npm dependencies**

## Architecture

```
index.html          → SPA shell (5 pages, data-theme driven)
styles.css          → All styling; 4 RPG themes via CSS custom properties
js/
  app.js            → Sole module entry, re-exports init
  init.js           → Bootstrap: event delegation, data-action binding, autosave
  state.js          → Global state, AI prompts (4 systems), CoC rules, skill defs
  theme.js          → RPG switching (body[data-theme]), SPA page navigation
  kp.js             → AI KP engine (SSE streaming, context compression, multi-provider)
  character.js      → Character sheet CRUD, portrait, attribute/skill/equipment rendering
  dice.js           → Dice roller (d4–d100), expression parser, roll history
  commands.js       → Parse/apply AI 【指令】 in chat output (SAN, HP, traits, memory)
  check-resolver.js → CoC two-pass streaming fallback: intercept 【检定请求】, roll D100
  coc-rules.js      → CoC 7e luck spending, pushed rolls, skill improvement
  coc-status.js     → Render SAN/HP/LUCK mini status bar, chronicle
  san.js            → CoC SAN loss table, insanity thresholds, daily tracking
  memory-bank.js    → Structured memory (NPCs, clues, plots, locations, session log)
  saves.js          → Full game state save/load/autosave to localStorage
  scenario.js       → Scenario knowledge DB for AI context injection
  notes.js          → Session notes CRUD (localStorage)
  api-browser.js    → D&D 5e SRD API browser (dnd5eapi.co)
  particles.js      → Canvas background particle animation
  dom.js            → Lazy-evaluated DOM element getters
  utils.js          → esc(), showToast(), modPct()
  multiplayer/
    index.js        → Multiplayer namespace (coordinator)
    connection.js   → WebSocket relay client (connect, reconnect, heartbeat)
    host.js         → Host logic (DM mode, turn management, AI passthrough)
    client.js       → Client logic (player mode)
    combat.js       → Combat phase turn ordering
    chase.js        → Chase phase logic
    game-start.js   → AI-generated game start scenarios
    ui.js           → Multiplayer UI rendering
cloudflare/
  worker.js         → Cloudflare Worker: API proxy + Durable Object WebSocket relay
  wrangler.toml     → Wrangler config
server.js           → Local dev server (Node.js, zero deps)
TTRPG.bat           → Windows launcher (starts server.js + opens browser)
```

## Running Locally

```bash
node server.js        # Starts on port 8080, auto-opens browser
# or
./TTRPG.bat           # Windows double-click launcher
```

The app works over `file://` for most features. The local server enables:
- API proxying to Anthropic/OpenAI/DeepSeek (bypasses CORS)
- WebSocket multiplayer relay

## Cloudflare Deployment

```bash
cd cloudflare
npx wrangler deploy     # Deploys worker to Cloudflare
```

The worker provides:
- `POST /api/proxy` — AI API proxy (whitelists Anthropic/OpenAI/DeepSeek endpoints)
- `WS /room/:id` — Multiplayer WebSocket relay (Durable Objects, broadcast/unicast/exclude)

## RPG Theme System

Four RPG systems controlled by `body[data-theme]` attribute:

| Theme | Value | Dice | AI Role |
|-------|-------|------|---------|
| D&D 5e | `dnd` | d20 | DM |
| CoC 7e | `coc` | d100 | KP (Keeper) |
| Cyberpunk RED | `cyberpunk` | d10 | GM |
| Pathfinder 2e | `pathfinder` | d20 | GM |

CSS custom properties cascade from `[data-theme]` selectors in `styles.css`. Each theme has its own color palette, font, and visual identity.

## AI KP Flow

1. User opens chat, selects a character, clicks the KP banner
2. `buildSystemPrompt()` assembles: base system prompt + fairness rules + character data + scenario DB + memory bank summary + recent chat history
3. SSE streaming request sent to configured provider (Anthropic/OpenAI/DeepSeek)
4. Responses stream in real-time via `ReadableStream` reader
5. Context compression triggers when approaching token limits (7-category structured summary)
6. AI commands (`【SAN: -1d6】`, `【ITEM: 旧钥匙】`, etc.) parsed and applied automatically
7. For CoC: the old fallback `【检定请求】` → frontend roll loop still exists in `check-resolver.js`, but the primary path now expects AI to roll inline via `【检定: skill D100=XX target=YY result】`

## Key Conventions

- All state lives in `state.js` exports (global singletons, no framework)
- `dom.js` provides lazy DOM references — always use `dom.someElement` instead of `getElementById`
- ESC modules use `import { x } from './y.js'` — always `.js` extension
- localStorage keys are prefixed `ttrpg-`
- Chinese UI language throughout
- No TypeScript, no JSX, no build step — edit and refresh
