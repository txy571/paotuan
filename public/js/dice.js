// ==================== DICE ROLLER ====================
// Handles single-die selection (d4–d100), custom expression rolling (e.g. 2d6+3),
// result animation, and persistent roll history (up to 100 entries).
// Dispatches 'dice-rolled' custom event for multiplayer broadcast integration.
import { state } from './state.js';
import { showToast } from './utils.js';
import { dom } from './dom.js';

export function selectDice(dice, btn) {
  state.currentDice = dice;
  document.querySelectorAll('.dice-die').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (dom.rollBtnLabel) dom.rollBtnLabel.textContent = `d${dice}`;
}

function animateResult(num, label, extraClass) {
  const el = dom.diceResultBig;
  if (!el) return;
  el.textContent = num;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'popIn .4s cubic-bezier(.68,-.55,.27,1.55)';
  el.className = 'dice-big-num ' + (extraClass || '');
  dom.diceResultLabel.textContent = label;
}

export function rollDice() {
  const dice = state.currentDice;
  const result = Math.floor(Math.random() * dice) + 1;
  const is20  = dice === 20 && result === 20;
  const is1   = dice === 20 && result === 1;

  let cls = '';
  let label;
  if (is20) { cls = 'crit-success'; label = '🎉 自然20! 大成功!'; }
  else if (is1) { cls = 'crit-fail'; label = '💀 自然1... 大失败...'; }
  else { label = `d${dice} 投掷结果`; }

  animateResult(result, label, cls);

  state.rollHistory.unshift({
    type:'single', dice, result, is20, is1,
    time: new Date().toLocaleTimeString()
  });
  if (state.rollHistory.length > 100) state.rollHistory.pop();
  renderRollHistory();

  document.dispatchEvent(new CustomEvent('dice-rolled', {
    detail: is20 ? `🎉 d20 = ${result} 大成功!` : is1 ? `💀 d20 = ${result} 大失败...` : `d${dice} = ${result}`
  }));
}

export function rollCustom() {
  const input = dom.customDice;
  if (!input) return;
  const val = input.value.trim();
  const match = val.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) { showToast('格式错误! 例如: 2d6+3 或 d20'); return; }

  const count = parseInt(match[1]) || 1;
  const sides = parseInt(match[2]);
  const mod   = parseInt(match[3]) || 0;
  if (count > 100) { showToast('骰子数量不能超过100'); return; }
  if (sides > 1000){ showToast('骰子面数不能超过1000'); return; }

  const rolls = []; let total = 0;
  for (let i=0; i<count; i++) { const r = Math.floor(Math.random()*sides)+1; rolls.push(r); total += r; }
  total += mod;

  const detail = count > 1
    ? `${rolls.join('+')}${mod?(mod>0?'+'+mod:mod):''} = ${total}`
    : `${total}`;

  animateResult(total, `${val} → ${detail}`);

  state.rollHistory.unshift({
    type:'custom', dice:sides, count, mod, result:total, rolls, detail,
    time: new Date().toLocaleTimeString()
  });
  if (state.rollHistory.length > 100) state.rollHistory.pop();
  renderRollHistory();

  document.dispatchEvent(new CustomEvent('dice-rolled', { detail: val }));
}

export function renderRollHistory() {
  const list = dom.rollHistory;
  if (!list) return;
  if (!state.rollHistory.length) {
    list.innerHTML = '<div class="empty-state">还没有投过骰子，手气如何？</div>';
    return;
  }
  list.innerHTML = state.rollHistory.map(r => {
    const icon = r.is20 ? '🎉' : r.is1 ? '💀' : '🎲';
    const text = r.detail || `d${r.dice} = ${r.result}`;
    let cls = '';
    if (r.is20) cls = 'crit-success';
    if (r.is1)  cls = 'crit-fail';
    return `<div class="roll-entry">
      <span class="roll-icon">${icon}</span>
      <span class="roll-text">${text}</span>
      <span class="roll-val ${cls}">${r.result}</span>
      <span class="roll-time">${r.time}</span>
    </div>`;
  }).join('');
}

export function clearRollHistory() {
  state.rollHistory = [];
  renderRollHistory();
  if (dom.diceResultBig) dom.diceResultBig.textContent = '—';
  if (dom.diceResultLabel) dom.diceResultLabel.textContent = '选择骰子然后投掷';
}
