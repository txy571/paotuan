# CLAUDE.md — 跑团助手 (TTRPG Companion)

An Astro-powered SPA for TTRPG. Supports solo play with an AI game master (KP/DM) and multiplayer via Cloudflare Workers WebSocket relay.

## Project Overview

- **Type**: Astro static site + client-side SPA + Cloudflare Worker backend
- **Framework**: Astro 6.x (SSG mode), no SSR
- **Languages**: JavaScript ES Modules, HTML5, CSS3, Node.js (local server)
- **Package manager**: npm

## Architecture

```
astro.config.mjs            → Astro build config (site: ttrpg.183107.xyz)
package.json                → npm scripts + deps
.github/workflows/deploy.yml → CI/CD: build → GitHub Pages
src/
  pages/index.astro         → SPA entry point, composes all 5 page sections
  layouts/MainLayout.astro  → HTML shell: <head>, nav, <slot/>, footer, script loader
  components/
    Nav.astro               → Global nav bar: light/dark toggle, clickable theme badge dropdown (desktop) / native select (mobile) + 5 page tabs
    Footer.astro            → Copyright + GitHub link + 问题反馈 (issues link)
    HomeSection.astro       → Home: RPG cards, AI KP chat, scenario DB, game saves
    CharacterSection.astro  → Character sheet: 3-col layout
    NotesSection.astro      → Markdown WYSIWYG editor (live preview), multi-select export/import, optional AES-GCM encryption
    MultiplayerSection.astro → Lobby + room views, player sidebar, KP panel
  styles/                   → 10 CSS modules (bundled by Astro at build)
public/
  CNAME                     → Custom domain
  js/                       → Client-side ES modules (copied as-is to dist/)
    prompts/                → AI system prompts (5 files, imported by state.js)
    multiplayer/            → Multiplayer modules (8 files)
dist/                       → Astro build output (static site)
cloudflare/
  worker.js                 → CF Worker: API proxy + Durable Object WS relay
  wrangler.toml
server.js                   → Local dev server + API proxy (serves dist/)
TTRPG.bat                   → Windows multi-mode launcher
```

## Pages (SPA Navigation)

5 logical pages, all rendered in `index.astro`, toggled by client-side JS:

| Page | ID | Component | Description |
|------|-----|-----------|-------------|
| Home | `#page-home` | HomeSection | AI KP chat, RPG selection, saves, scenario DB |
| Character | `#page-character` | CharacterSection | 3-col character sheet |
| Notes | `#page-notes` | NotesSection | Session notes |
| Multiplayer | `#page-multiplayer` | MultiplayerSection | Lobby + room |

## Running Locally

```bash
npm install             # Install dependencies
npx astro dev           # Astro dev server with HMR (http://localhost:4321)
npm run build           # Production build to dist/
npm run preview         # Preview production build
node server.js          # Node.js static server + API proxy (serves dist/)
./TTRPG.bat             # Windows launcher menu
```

## Build & Deploy

- **Build**: `astro build` → outputs to `dist/`
- **Deploy**: Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds with Astro and deploys to GitHub Pages
- **GitHub Pages Setting**: MUST be set to **"GitHub Actions"** (not "Deploy from a branch")
- **Custom domain**: ttrpg.183107.xyz (CNAME in `public/`)
- **PWA**: manifest.json in `public/`, icons in `public/icons/` (see plan for required sizes)

## Theme System

- **RPG theme**: `body[data-theme]` controls rule system (dnd/coc/cyberpunk/pathfinder) — accent colors, fonts, ornaments differ per system
- **Color scheme**: `body[data-color-scheme]` controls light/dark mode, orthogonal to RPG theme (works with all 4 systems)
- Theme badge in Nav: click to open dropdown (desktop) or use native `<select>` (mobile ≤700px)
- Light mode toggle button (sun/moon icon) in nav bar
- All color scheme preferences persisted in `localStorage` key `ttrpg-color-scheme`

## Notes System (Enhanced)

- **Markdown WYSIWYG**: textarea with real-time rendered preview below (via marked.js CDN)
- **Toolbar**: quick-insert buttons for bold, italic, heading, list, link, quote, code, hr
- **Multi-select export**: checkboxes on note cards, "导出选中" for JSON download
- **Encrypted export**: AES-GCM via Web Crypto API (PBKDF2 key derivation, 100k iterations)
- **Import**: merge-import JSON files, auto-detect encrypted envelopes, skip duplicates by id

## AI KP Flow

1. User selects character, clicks KP banner → `openKPPanel()` in `kp.js`
2. `buildSystemPrompt()` assembles: `KP_SHARED_PREAMBLE` (fixed ~2500 chars, from `prompts/shared-preamble.js`) + system-specific prompt (from `prompts/{dnd|coc|cyberpunk|pathfinder}.js`) + dynamic extra (character data, scenario DB, memory bank)
3. SSE streaming via configured provider (Anthropic/OpenAI/DeepSeek)
4. AI commands parsed by `commands.js` and applied automatically

## Prompt Files (Cache-Optimized)

All in `public/js/prompts/`:
- `shared-preamble.js` — identical across all 4 RPG systems, position 0 for Anthropic cache reuse
- `dnd.js`, `coc.js`, `cyberpunk.js`, `pathfinder.js` — system-specific rules

## Key Conventions

- All state in `state.js` exports (global singletons, no framework)
- `dom.js` provides lazy DOM references — always use `dom.someElement`
- ES modules use `import { x } from './y.js'` — always `.js` extension
- localStorage keys prefixed `ttrpg-`
- Chinese UI language throughout
- No TypeScript, no JSX (Astro components are `.astro` HTML superset)
- Character portrait auto-compresses to <100KB (canvas resize + JPEG quality adjustment) on upload
