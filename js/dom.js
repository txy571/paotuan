// ==================== DOM REFERENCE CACHE ====================
// Centralized, lazily-evaluated DOM element references.
// Each property is a getter that calls document.getElementById(),
// allowing elements to be accessed by any module before the DOM is ready
// (the lookup happens at access time, not at import time).
import { $ } from './utils.js';

export const dom = {
  get particles()     { return $('particles'); },
  get themeBadge()    { return $('themeBadge'); },
  get attrGrid()      { return $('attrGrid'); },
  get ptsRemaining()  { return $('ptsRemaining'); },
  get skillsList()    { return $('skillsList'); },
  get traitList()     { return $('traitList'); },
  get featList()      { return $('featList'); },
  get equipTable()    { return $('equipTable'); },
  get equipName()     { return $('equipName'); },
  get equipQty()      { return $('equipQty'); },
  get equipWeight()   { return $('equipWeight'); },
  get equipDesc()     { return $('equipDesc'); },
  get equipCategory() { return $('equipCategory'); },
  get spellsList()    { return $('spellsList'); },
  get charEra()       { return $('charEra'); },
  get eraInfo()       { return $('eraInfo'); },
  get savedCharsList(){ return $('savedCharsList'); },
  get diceResultBig() { return $('diceResultBig'); },
  get diceResultLabel(){return $('diceResultLabel'); },
  get rollBtnLabel()  { return $('rollBtnLabel'); },
  get rollHistory()   { return $('rollHistory'); },
  get customDice()    { return $('customDice'); },
  get sessionsList()  { return $('sessionsList'); },
  get sessionTitle()  { return $('sessionTitle'); },
  get sessionContent(){ return $('sessionContent'); },
  get apiResults()    { return $('apiResults'); },
  get initiativeList(){ return $('initiativeList'); },
  get initName()      { return $('initName'); },
  get initRoll()      { return $('initRoll'); },
  get portraitZone()  { return $('portraitZone'); },
  get portraitImg()   { return $('portraitImg'); },
  get portraitPlaceholder() { return $('portraitPlaceholder'); },
};
