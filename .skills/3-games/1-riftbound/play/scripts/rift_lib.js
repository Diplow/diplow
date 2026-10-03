// rift_lib.js — page-context helpers for driving TCG Arena (Riftbound) via the
// Claude-in-Chrome `javascript_tool`. Inject ONCE per game session (paste this whole
// file into javascript_tool); it defines `window.rift`. Re-injecting is harmless.
//
// TCG Arena is a React/DOM app (NO canvas): every card is a `.game-card` element.
//   - identity : <img> front, pathname ".../OGN-199/full-desktop-2x.avif" -> set-id "OGN-199".
//                Some cards render full-art ".../game_data_live/<hash>-WxH.png" instead; loadCatalog()
//                supplies hash->set-id (from card_ids.json hash_ids) so both render paths resolve.
//   - zone     : a token in the element className (Hand, Stack, Battlefields, Sideboard, ...)
//   - engaged  : className contains "tapped"
//   - coords   : getBoundingClientRect() is in VIEWPORT space (~1920 wide); the click tool
//                (`computer`) is in SCREENSHOT space (1568 wide) -> scale by 1568/innerWidth.
//
// DESIGN RULE: this lib only READS + VALIDATES (returns plans). It performs NO game action.
// The orchestrator acts with REAL clicks (computer tool / browser_batch). Only `sendChat`
// touches the page, and chat is not game state (no multiplayer desync risk).

window.rift = (function () {
  // Rune set-ids. Extend when other domains enter play (Fury/Mind/Body/Order...).
  const ID_TO_COLOR = { 'OGN-042': 'calm', 'OGN-166': 'chaos' };

  const scale = () => 1568 / window.innerWidth;             // viewport px -> screenshot px
  const clampY = (y) => Math.min(y, 718);                   // keep clicks inside the visible viewport
  const norm = (s) => (s || '').replace(/, /g, ' - ').trim().toLowerCase();

  // Catalog injected from decks/<...>/card_ids.json via loadCatalog().
  let NAME_TO_ID = {};   // normalised name -> set-id
  let HASH_TO_ID = {};   // full-art image hash -> set-id
  function loadCatalog(cat) {
    NAME_TO_ID = {};
    Object.entries((cat && cat.ids) || {}).forEach(([n, id]) => { NAME_TO_ID[norm(n)] = id; });
    HASH_TO_ID = (cat && cat.hash_ids) || {};
    return { names: Object.keys(NAME_TO_ID).length, hashes: Object.keys(HASH_TO_ID).length };
  }
  const resolveName = (name) => NAME_TO_ID[norm(name)] || null;

  // set-id of a card image src:
  //   ".../OGN-289/full-desktop-2x.avif"        -> "OGN-289"
  //   ".../game_data_live/<hash>-WxH.png"        -> HASH_TO_ID[hash] (or null if catalog missing)
  function idFromSrc(src) {
    let segs;
    try { segs = new URL(src).pathname.split('/').filter(Boolean); }
    catch (e) { return null; }
    const last2 = segs.slice(-2);
    if (last2[0] === 'game_data_live') return HASH_TO_ID[(last2[1] || '').split('-')[0]] || null;
    return last2[0] || null;
  }

  function idOf(el) {
    const f = el.querySelector('img:not([src*="cardBack"])');
    return f ? idFromSrc(f.src) : null;
  }

  function readCards() {
    const SX = scale(), H = window.innerHeight;
    return Array.from(document.querySelectorAll('.game-card')).map((el) => {
      const cls = (typeof el.className === 'string' ? el.className : '');
      const r = el.getBoundingClientRect();
      return {
        id: idOf(el),
        cls,
        faceUp: !!el.querySelector('img:not([src*="cardBack"])'),
        tapped: /\btapped\b/.test(cls),
        x: Math.round((r.x + r.width / 2) * SX),
        y: Math.round((r.y + r.height / 2) * SX),
        vy: r.y,
        mine: r.y > H * 0.45,                                // my side = bottom half (red border ~mid)
      };
    }).filter((c) => c.vy > 0);
  }

  const inZone = (c, z) => new RegExp('\\b' + z + '\\b').test(c.cls);

  // Full readable state of MY side (+ the shared stack / battlefields).
  function readState() {
    const C = readCards();
    return {
      hand: C.filter((c) => c.mine && inZone(c, 'Hand')).map((c) => ({ id: c.id, x: c.x, y: clampY(c.y) })),
      stack: C.filter((c) => inZone(c, 'Stack')).map((c) => ({ id: c.id, x: c.x, y: c.y })),
      battlefields: C.filter((c) => inZone(c, 'Battlefields')).map((c) => ({ id: c.id, mine: c.mine, x: c.x, y: c.y })),
      runes: C.filter((c) => ID_TO_COLOR[c.id] && c.mine)
        .map((c) => ({ color: ID_TO_COLOR[c.id], tapped: c.tapped, x: c.x, y: c.y }))
        .sort((a, b) => a.x - b.x),
    };
  }

  // Plan a card play WITHOUT acting.
  //   targetId : set-id of the card in hand (e.g. "OGN-199")
  //   cost     : array of rune colors to engage, e.g. ["calm","calm"] = pay with 2 Calm
  // Returns { status:'proceed', target, runeClicks:[{x,y}...], cardClick:{x,y} }
  //      or { status:'error', reason }
  function decidePlay(targetId, cost) {
    const C = readCards();
    const card = C.find((c) => c.id === targetId && c.mine && inZone(c, 'Hand'));
    if (!card) return { status: 'error', reason: `card ${targetId} not in hand` };

    const ready = {};
    C.filter((c) => ID_TO_COLOR[c.id] && c.mine && !c.tapped)
      .forEach((c) => { const col = ID_TO_COLOR[c.id]; (ready[col] = ready[col] || []).push(c); });

    const need = {};
    (cost || []).forEach((col) => { need[col] = (need[col] || 0) + 1; });
    for (const col in need) {
      const have = (ready[col] || []).length;
      if (have < need[col]) return { status: 'error', reason: `need ${need[col]} untapped ${col}, have ${have}` };
    }

    const runeClicks = [], used = {};
    for (const col of cost) {
      used[col] = used[col] || 0;
      const r = ready[col][used[col]++];
      runeClicks.push({ x: r.x, y: r.y });
    }
    return { status: 'proceed', target: targetId, runeClicks, cardClick: { x: card.x, y: clampY(card.y) } };
  }

  // Post a chat message. React-controlled input -> focus + native value setter + Enter keydown.
  // Returns false only if the input is missing; otherwise true (best-effort). NOTE: do NOT
  // check `i.value === ''` synchronously to confirm a send — React clears the input on the
  // NEXT render tick, so an immediate re-read is a false negative. The send itself works.
  function sendChat(msg) {
    const i = document.querySelector('input[placeholder*="Chat" i]');
    if (!i) return false;
    i.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, msg);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    return true;
  }

  // Last N game-log lines (text = source of truth; never trust vision/prose).
  function readLog(n) {
    return Array.from(document.querySelectorAll('div,span,p,li'))
      .filter((e) => /from hand|played|returned|drew|Rune|ok\?|conquer|move/i.test(e.textContent) && e.children.length <= 1)
      .slice(-(n || 6)).map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 80));
  }

  // Locate a button by its exact (case-insensitive) label; returns scaled center coords.
  function findButton(label) {
    const b = Array.from(document.querySelectorAll('button'))
      .find((el) => el.textContent.trim().toLowerCase() === label.toLowerCase());
    if (!b) return null;
    const r = b.getBoundingClientRect(), SX = scale();
    return { x: Math.round((r.x + r.width / 2) * SX), y: Math.round((r.y + r.height / 2) * SX) };
  }

  // Board-card-selection modal: locate the battlefield image matching `name` and the
  // Continue button. LOCATE only (no action). Needs loadCatalog() first.
  //   -> { status:'proceed', battlefield, bfClick:{x,y}, continueClick:{x,y} } | { status:'error', reason }
  function chooseBattlefield(name) {
    const setId = resolveName(name);
    if (!setId) return { status: 'error', reason: `unknown card ${name} (loadCatalog first?)` };
    const SX = scale();
    const hit = Array.from(document.querySelectorAll('img'))
      .map((im) => { const r = im.getBoundingClientRect(); return { id: idFromSrc(im.src), w: r.width, vy: r.y, x: Math.round((r.x + r.width / 2) * SX), y: Math.round((r.y + r.height / 2) * SX) }; })
      .find((o) => o.id === setId && o.w > 120 && o.vy > 120 && o.vy < 620);
    if (!hit) return { status: 'error', reason: `battlefield ${name} (${setId}) not on selection screen` };
    const cont = findButton('Continue');
    if (!cont) return { status: 'error', reason: 'Continue button not found' };
    return { status: 'proceed', battlefield: setId, bfClick: { x: hit.x, y: hit.y }, continueClick: cont };
  }

  // Mulligan modal: locate the named cards (the 4 large opening cards) so the caller can
  // toggle each for replacement. LOCATE only, max 2. Needs loadCatalog().
  //   -> { status:'proceed', cardClicks:[{name,x,y}] } | { status:'error', reason }
  function mulligan(names) {
    if (!names || !names.length) return { status: 'error', reason: 'no cards given' };
    if (names.length > 2) return { status: 'error', reason: 'max 2 cards' };
    const SX = scale();
    const imgs = Array.from(document.querySelectorAll('img:not([src*="cardBack"])'))
      .map((im) => { const r = im.getBoundingClientRect(); return { id: idFromSrc(im.src), w: r.width, vy: r.y, x: Math.round((r.x + r.width / 2) * SX), y: Math.round((r.y + r.height / 2) * SX) }; })
      .filter((o) => o.w > 110 && o.vy > 180 && o.vy < 560);
    const cardClicks = [];
    for (const name of names) {
      const id = resolveName(name);
      const hit = imgs.find((o) => o.id === id);
      if (!hit) return { status: 'error', reason: `mulligan card ${name} (${id}) not in modal` };
      cardClicks.push({ name, x: hit.x, y: hit.y });
    }
    return { status: 'proceed', cardClicks };
  }

  // The "Mulligan (N)" confirm button (appears once >=1 card is marked). LOCATE only.
  function mulliganButton() {
    const b = Array.from(document.querySelectorAll('button')).find((el) => /^mulligan\s*\(/i.test(el.textContent.trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect(), SX = scale();
    return { x: Math.round((r.x + r.width / 2) * SX), y: Math.round((r.y + r.height / 2) * SX), label: b.textContent.trim() };
  }

  // Move one or more of MY units to a location. LOCATE only -> caller `left_click_drag`s each.
  //   units    : name/set-id, or array of them (units currently on my side: base or a battlefield)
  //   location : 'base' | 'battlefield:<name>'  (a unit goes to the B1/B2 combat zone *below* the
  //              battlefield card — NOT onto the card itself)
  //   -> { status:'proceed', moves:[{unit, from:{x,y}, to:{x,y}}] } | { status:'error', reason }
  function move(units, location) {
    units = Array.isArray(units) ? units : [units];
    const SX = scale(), H = window.innerHeight;
    const sects = Array.from(document.querySelectorAll('[class*=dropable]'))
      .map((el) => { const r = el.getBoundingClientRect(); return { r, cx: r.x + r.width / 2, w: r.width, vy: r.y }; });
    const center = (z) => ({ x: Math.round((z.r.x + z.r.width / 2) * SX), y: Math.round((z.r.y + z.r.height / 2) * SX) });
    let to = null;
    if (location === 'base') {
      const z = sects.filter((s) => s.vy > H * 0.65 && s.w > 100).sort((a, b) => b.w - a.w)[0];   // widest bottom = base
      if (z) to = center(z);
    } else if (/^battlefield:/i.test(location)) {
      const bfId = resolveName(location.replace(/^battlefield:/i, '').trim());
      const bfEl = Array.from(document.querySelectorAll('.game-card')).find((el) => idOf(el) === bfId && /\bBattlefields\b/.test(el.className || ''));
      if (!bfEl) return { status: 'error', reason: `battlefield ${location} not found` };
      const r = bfEl.getBoundingClientRect(), bx = r.x + r.width / 2;
      const z = sects.filter((s) => s.vy > H * 0.45 && s.vy < H * 0.65 && s.w > 300 && Math.abs(s.cx - bx) < 320)
        .sort((a, b) => Math.abs(a.cx - bx) - Math.abs(b.cx - bx))[0];                              // big combat zone under that battlefield
      if (z) to = center(z);
    }
    if (!to) return { status: 'error', reason: `location ${location} not resolvable` };
    const moves = [];
    for (const u of units) {
      const uid = resolveName(u) || u;
      const el = Array.from(document.querySelectorAll('.game-card')).find((e) => idOf(e) === uid && e.getBoundingClientRect().y > H * 0.45);
      if (!el) return { status: 'error', reason: `unit ${u} not on my side` };
      const r = el.getBoundingClientRect();
      moves.push({ unit: u, from: { x: Math.round((r.x + r.width / 2) * SX), y: Math.round((r.y + r.height / 2) * SX) }, to });
    }
    return { status: 'proceed', moves };
  }

  // Set my points (bottom-left counter). delta defaults to +1 (a Conquer). Returns the new total.
  // The counter is a React-controlled <input>, so use the native value setter + input/change
  // (like sendChat) — coordinate-clicking its tiny ▲/▼ is unreliable. Acts directly (manual counter,
  // not a tactical card move). Help menu: "You can mark your points at the bottom left."
  function score(delta) {
    const pc = Array.from(document.querySelectorAll('[class*=player-counters]'))
      .find((el) => el.getBoundingClientRect().y > window.innerHeight * 0.45);
    const inp = pc && pc.querySelector('input');
    if (!inp) return false;
    const next = Math.max(0, (parseInt(inp.value || '0', 10) || 0) + (delta == null ? 1 : delta));
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, String(next));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return next;
  }

  // Blur the chat/input so keyboard shortcuts reach the GAME (Space = end turn, R = remove...).
  // Call this before any computer `key` action, otherwise the keypress goes into the chat box.
  function defocus() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (document.body && document.body.focus) document.body.focus();
    return true;
  }

  // Resolve the top stack card by DRAGGING it to a drop-zone. LOCATE only (no action):
  // the caller runs `left_click_drag(dragFrom -> dragTo)`. The sim auto-places the card
  // (a unit on the base enters tapped automatically). Resolution is gated by priority:
  // both players must pass first (each drags / passes on their own screen).
  //   location: 'base' (default). [TODO: 'battlefield:<name>', spell -> Trash/discard]
  //   -> { status:'proceed', dragFrom:{x,y}, dragTo:{x,y} } | { status:'error', reason }
  function resolve(location) {
    location = location || 'base';
    const SX = scale(), H = window.innerHeight;
    const stackEls = Array.from(document.querySelectorAll('.game-card'))
      .filter((el) => /\bStack\b/.test(typeof el.className === 'string' ? el.className : ''));
    if (!stackEls.length) return { status: 'error', reason: 'stack empty' };
    const rev = (el) => { const m = (el.className || '').match(/reversed-index-(\d+)/); return m ? +m[1] : 0; };
    const top = stackEls.sort((a, b) => rev(a) - rev(b))[0];            // top of LIFO (reversed-index 0)
    const sr = top.getBoundingClientRect();
    const dragFrom = { x: Math.round((sr.x + sr.width / 2) * SX), y: Math.round((sr.y + sr.height / 2) * SX) };
    let zone = null;
    if (location === 'base') {
      // my side, bottom row, widest dropable section = the Base (vs the narrower runes area)
      zone = Array.from(document.querySelectorAll('[class*=dropable]'))
        .map((el) => { const r = el.getBoundingClientRect(); return { r, w: r.width, vy: r.y }; })
        .filter((s) => s.vy > H * 0.65 && s.w > 100)
        .sort((a, b) => b.w - a.w)[0];
    }
    if (!zone) return { status: 'error', reason: `location ${location} not found` };
    const dragTo = { x: Math.round((zone.r.x + zone.r.width / 2) * SX), y: Math.round((zone.r.y + zone.r.height / 2) * SX) };
    return { status: 'proceed', dragFrom, dragTo };
  }

  return { readState, decidePlay, sendChat, readLog, loadCatalog, resolveName, chooseBattlefield, findButton, mulligan, mulliganButton, resolve, move, score, defocus, ID_TO_COLOR };
})();
'rift_lib loaded';
