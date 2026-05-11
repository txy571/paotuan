const fs = require('fs');
const css = fs.readFileSync('styles.css', 'utf8');

// Split CSS into top-level blocks using brace-depth tracking
function splitBlocks(css) {
  const blocks = [];
  let depth = 0, blockStart = 0, inComment = false;

  for (let i = 0; i < css.length; i++) {
    if (css[i] === '/' && css[i+1] === '*' && !inComment) { inComment = true; i++; continue; }
    if (css[i] === '*' && css[i+1] === '/' && inComment) { inComment = false; i++; continue; }
    if (inComment) continue;

    if (css[i] === '{') {
      if (depth === 0) {
        // Find selector start (go backwards, skipping whitespace and comments)
        let s = i - 1;
        while (s >= 0 && /\s/.test(css[s])) s--;
        // Go back to start of selector (previous } or beginning)
        let selStart = s;
        while (selStart > 0) {
          if (css[selStart] === '}') { selStart++; break; }
          selStart--;
        }
        blockStart = selStart;
      }
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        blocks.push(css.substring(blockStart, i + 1).trim());
      }
    }
  }
  return blocks;
}

const blocks = splitBlocks(css);
console.log(`Found ${blocks.length} top-level CSS blocks`);

// Map blocks to modules
const modules = {
  'css/reset.css': [],
  'css/themes.css': [],
  'css/layout.css': [],
  'css/components.css': [],
  'css/character.css': [],
  'css/dice.css': [],
  'css/kp.css': [],
  'css/multiplayer.css': [],
  'css/coc.css': [],
  'css/responsive.css': [],
};

const byFile = {};

for (const block of blocks) {
  const firstLine = block.split('\n')[0].trim();
  let target = 'css/layout.css'; // default

  // Reset & root variables
  if (block.match(/^\*/) || block.match(/^::/) || block.match(/::-webkit-scrollbar/)) {
    target = 'css/reset.css';
  } else if (block.match(/^:root\b/)) {
    target = 'css/reset.css';
  }
  // Themes
  else if (block.match(/^\[data-theme=/)) {
    target = 'css/themes.css';
  }
  // Responsive & print
  else if (block.match(/^@media/) || block.includes('@media print')) {
    target = 'css/responsive.css';
  }
  // Keyframes — distribute by purpose
  else if (block.match(/^@keyframes/)) {
    const name = block.match(/@keyframes\s+(\w+)/)?.[1] || '';
    if (['kp-float','kp-pulse','kp-arrow','msgIn','blink'].includes(name)) target = 'css/kp.css';
    else if (['toastIn','toastOut'].includes(name)) target = 'css/components.css';
    else if (['spin'].includes(name)) target = 'css/multiplayer.css';
    else target = 'css/layout.css'; // fadeIn, pulse-border
  }
  // KP interface
  else if (block.match(/^\.kp-/) || block.match(/^#kp/) || block.match(/^\.msg-header/) ||
           block.match(/^\.msg-dice/) || block.match(/^\.game-save/) || block.match(/^\.scenario/) ||
           block.match(/^\.kp-theme-tag/) || block.match(/^\.spells-hint/) ||
           block.match(/^\.coc-chronicle/) || block.match(/^#cocSkillChecks/)) {
    target = 'css/kp.css';
  }
  // Multiplayer
  else if (block.match(/^\.mp-/) || block.match(/^#mp/) || block.match(/^\.combat-/) ||
           block.match(/^\.chase/) || block.match(/^\.timeout-bar/) || block.match(/^\.combatant-/)) {
    target = 'css/multiplayer.css';
  }
  // CoC-specific
  else if (block.match(/^\.coc-/) || block.match(/^\.chronicle-/) || block.match(/^\.skill-row-coc/) ||
           block.match(/^\.skill-name-coc/) || block.match(/^\.skill-base-coc/) ||
           block.match(/^\.skill-val-input/) || block.match(/^\.skill-pct/)) {
    target = 'css/coc.css';
  }
  // Dice roller
  else if (block.match(/^\.dice-/) || block.match(/^\.roll-/) || block.match(/^#dice/) ||
           block.match(/^#roll/)) {
    target = 'css/dice.css';
  }
  // Character sheet
  else if (block.match(/^\.char-layout/) || block.match(/^\.portrait-/) || block.match(/^\.attr-/) ||
           block.match(/^\.skills-/) || block.match(/^\.skill-chip/) || block.match(/^\.skill-dot/) ||
           block.match(/^\.skill-name/) || block.match(/^\.skill-bonus/) || block.match(/^\.equip-/) ||
           block.match(/^\.trait-tag/) || block.match(/^\.trait-remove/) || block.match(/^\.feat/) ||
           block.match(/^\.spell-/) || block.match(/^\.initiative-/) || block.match(/^\.init-row/) ||
           block.match(/^\.init-name/) || block.match(/^\.init-num/) || block.match(/^\.init-hp/) ||
           block.match(/^\.pts-/) || block.match(/^\.char-select-/) || block.match(/^\.tag-row/) ||
           block.match(/^\.inline-input/)) {
    target = 'css/character.css';
  }
  // Buttons, forms, panels — shared components
  else if (block.match(/^\.btn/) || block.match(/^\.btn-/) || block.match(/^\.btn:/) ||
           block.match(/^input/) || block.match(/^select/) || block.match(/^textarea/) ||
           block.match(/^label/) || block.match(/^\.panel/) || block.match(/^\.panel-/) ||
           block.match(/^\.toast/) || block.match(/^\.toast-/) || block.match(/^\.empty-state/) ||
           block.match(/^\.loading-state/) || block.match(/^\.error-state/) || block.match(/^\.tag\b/)) {
    target = 'css/components.css';
  }
  // Layout & navigation
  else if (block.match(/^body/) || block.match(/^#particles/) || block.match(/^#app/) ||
           block.match(/^nav\b/) || block.match(/^\.nav-/) || block.match(/^\.page/) ||
           block.match(/^\.hero/) || block.match(/^\.rpg-/) || block.match(/^\.api-/) ||
           block.match(/^\.theme-badge/) || block.match(/^#home/) || block.match(/^\.char-select-section/) ||
           block.match(/^\.char-select-header/) || block.match(/^\.char-select-list/) ||
           block.match(/^\.char-select-empty/) || block.match(/^\.char-select-card/) ||
           block.match(/^\.char-select-dot/) || block.match(/^\.char-select-info/) ||
           block.match(/^\.char-select-name/) || block.match(/^\.char-select-meta/)) {
    target = 'css/layout.css';
  }

  if (!byFile[target]) byFile[target] = [];
  byFile[target].push(block);
}

// Write files
const headers = {
  'css/reset.css': 'CSS Module: Reset & Design Tokens\n— CSS reset, :root custom properties, scrollbar styles\n— Spacing scale, shadow hierarchy, border tokens, transition curves',
  'css/themes.css': 'CSS Module: RPG Themes\n— D&D 5e, Call of Cthulhu 7e, Cyberpunk RED, Pathfinder 2e\n— Each theme: bg colors, text, accent, border, shadow, font, dice face',
  'css/layout.css': 'CSS Module: Layout & Navigation\n— Body background, particles canvas, app container\n— Navigation bar, tabs, theme badge, page transitions\n— Hero section, RPG card grid, API browser\n— Character selection section (home page)',
  'css/components.css': 'CSS Module: Shared Components\n— Panels, forms (inputs/selects/textareas), buttons (all variants)\n— Tags, toast notifications, empty/loading/error states\n— Game save items, portrait zone',
  'css/character.css': 'CSS Module: Character Sheet\n— Layout grid (3-column), attribute bars, point-buy tracker\n— Skills grid, equipment table, spells, traits, feats\n— Initiative tracker, inline inputs',
  'css/dice.css': 'CSS Module: Dice Roller\n— Dice strip (d4-d100), result display, custom roll input\n— Roll history list',
  'css/kp.css': 'CSS Module: AI Game Master Interface\n— KP hero banner with animations, chat panel, messages\n— Quick actions, config panel, game saves, scenario DB, chronicle',
  'css/multiplayer.css': 'CSS Module: Multiplayer System\n— Lobby (create/join), room (header/sidebar/main)\n— Chat messages, input area, player slots, connection overlay\n— Combat phase, chase phase',
  'css/coc.css': 'CSS Module: Call of Cthulhu 7e Components\n— Status bars (HP/SAN/LUCK), chronicle, skill rows\n— Combat UI: round badge, combatant tags, timeout bar',
  'css/responsive.css': 'CSS Module: Responsive & Print\n— Mobile (≤700px), tablet (701-960px), component breakpoints\n— Print styles: hide interactive elements',
};

for (const [file, fileBlocks] of Object.entries(byFile)) {
  if (fileBlocks.length === 0) continue;

  const header = headers[file] || file;
  const content = `/* ============================================================
   ${header.split('\n').join('\n   ')}
   ============================================================ */

${fileBlocks.join('\n\n')}
`;
  fs.writeFileSync(file, content);
  const opens = (content.match(/\{/g) || []).length;
  const closes = (content.match(/\}/g) || []).length;
  console.log(`${file}: ${fileBlocks.length} blocks, {=${opens} }=${closes} ${opens === closes ? 'OK' : 'MISMATCH'}`);
}
console.log(`\nDone. Total blocks distributed: ${Object.values(byFile).reduce((s,a)=>s+a.length,0)}`);
