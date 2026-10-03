# 🎁 Simulateur de boosters

> [!info]- Comment ça marche
> Choisis un set, un nombre de boosters, clique sur **Ouvrir** : chaque booster affiche ses 14 cartes face cachée. Clique sur une carte pour la révéler, ou coche **Tout révéler**. Chaque booster ouvert est ajouté à la collection (persistée dans `booster_collection.json`), consultable dans [[Booster Collection]].
>
> **Modèle de booster** (d'après la répartition officielle *Collectability in Riftbound*) : 7 Communes · 3 Peu communes · 2 slots Rare+ (12,5 % de chance d'Épique chacun, soit ~1 booster sur 4 avec un Épique) · 1 foil (50 % C / 30 % UC / 13 % R / 7 % E) · 1 rune de base. Les variantes Showcase ne sont pas simulées. Les runes de base viennent toujours d'Origins (elles n'existent que là).
>
> Nécessite le plugin **Dataview** (installé dans ce vault) avec les requêtes JavaScript activées.

```dataviewjs
/* ============ Simulateur de boosters Riftbound ============ */

const SETS = ["OGN", "SFD", "UNL"];
const SET_LABELS = { OGN: "Origins", SFD: "Spiritforged", UNL: "Unleashed" };
const BASE = dv.current().file.folder;
const COLLECTION_PATH = `${BASE}/booster_collection.json`;
const RARITY_FR = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Epic: "Épique" };
const RARITY_COLOR = { Common: "#9aa0a6", Uncommon: "#4caf50", Rare: "#42a5f5", Epic: "#ab47bc" };

/* ---------- Styles ---------- */
const style = document.createElement("style");
style.textContent = `
.rb-sim { font-family: var(--font-interface); }
.rb-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:8px 0 16px; }
.rb-toolbar select { padding:4px 8px; border-radius:6px; }
.rb-btn { padding:6px 14px; border-radius:8px; cursor:pointer; border:1px solid var(--background-modifier-border);
  background:var(--interactive-normal); font-weight:600; }
.rb-btn:hover { background:var(--interactive-hover); }
.rb-btn-accent { background:var(--interactive-accent); color:var(--text-on-accent); border:none; }
.rb-btn-accent:hover { background:var(--interactive-accent-hover); }
.rb-check { display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none; }
.rb-zoom { display:flex; align-items:center; gap:6px; user-select:none; }
.rb-zoom input[type=range] { width:130px; }
.rb-count-input { width:58px; padding:4px 6px; border-radius:6px; text-align:center; }

.rb-pack { display:grid; grid-template-columns:repeat(auto-fill, minmax(var(--rb-zoom, 120px), 1fr)); gap:10px; margin-bottom:20px; }
.rb-pack-title { font-weight:700; font-size:.92em; color:var(--text-muted); margin:10px 0 4px; }
.rb-card { perspective:800px; cursor:pointer; }
.rb-card-inner { position:relative; width:100%; aspect-ratio:300/419; transform-style:preserve-3d;
  transition:transform .5s ease; }
.rb-card.rb-revealed .rb-card-inner { transform:rotateY(180deg); }
.rb-face { position:absolute; inset:0; backface-visibility:hidden; border-radius:7px; overflow:hidden; }
.rb-back { background:linear-gradient(145deg, #1a1c2e 0%, #2d1b4e 55%, #16213e 100%);
  border:2px solid #c9a227; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
.rb-back::before { content:""; position:absolute; inset:7px; border:1px solid rgba(201,162,39,.55); border-radius:5px; }
.rb-back-gem { width:34px; height:34px; transform:rotate(45deg); border:2px solid #c9a227; border-radius:6px;
  background:radial-gradient(circle at 30% 30%, #5a3d8a, #241540); }
.rb-back-title { color:#c9a227; font-size:.62em; letter-spacing:.28em; font-weight:700; }
.rb-front { transform:rotateY(180deg); background:var(--background-secondary); }
.rb-front img { width:100%; height:100%; object-fit:cover; display:block; }
.rb-badge { position:absolute; bottom:4px; right:4px; font-size:.62em; font-weight:700; padding:1px 7px;
  border-radius:9px; color:white; opacity:.92; }
.rb-foil .rb-face { box-shadow:0 0 0 2px #c9a227, 0 0 12px 2px rgba(255,215,80,.55); }
.rb-foil-star { position:absolute; top:4px; left:6px; color:#ffd750; text-shadow:0 0 4px #000; font-size:.9em; z-index:2; }

.rb-coll-line { color:var(--text-muted); font-size:.9em; margin:4px 0 12px; }
`;
dv.container.appendChild(style);

/* ---------- Données ---------- */
function cardFile(setId, name) {
  let stem = name.split(" - ").join(", ");
  for (const ch of '<>:"/\\|?*') stem = stem.split(ch).join("-");
  return `${BASE}/sets/${setId}/cards/images/${stem.trim()}.png`;
}
const imgSrc = (setId, name) => app.vault.adapter.getResourcePath(cardFile(setId, name));

const pools = {};   // pools[set] = { Common:[], Uncommon:[], Rare:[], Epic:[] } (hors Showcase, hors Runes)
let runePool = [];  // runes de base (OGN uniquement)
for (const sid of SETS) {
  const raw = JSON.parse(await app.vault.adapter.read(`${BASE}/sets/${sid}/source.json`));
  const p = { Common: [], Uncommon: [], Rare: [], Epic: [] };
  for (const c of raw) {
    const r = c.classification.rarity, t = c.classification.type;
    const card = { set: sid, name: c.name, rarity: r, cn: c.collector_number };
    if (t === "Rune" && r === "Common") { runePool.push(card); continue; }
    if (p[r]) p[r].push(card);
  }
  pools[sid] = p;
}

/* ---------- Collection (persistance) ---------- */
async function loadCollection() {
  try {
    if (await app.vault.adapter.exists(COLLECTION_PATH))
      return JSON.parse(await app.vault.adapter.read(COLLECTION_PATH));
  } catch (e) { console.error("Booster sim: collection illisible", e); }
  return { boosters: {}, cards: {} };
}
const saveCollection = () =>
  app.vault.adapter.write(COLLECTION_PATH, JSON.stringify(collection, null, 2));
let collection = await loadCollection();

function addToCollection(setId, pulls) {
  collection.boosters[setId] = (collection.boosters[setId] || 0) + 1;
  for (const p of pulls) {
    const key = `${p.set}|${p.name}|${p.foil ? "F" : "N"}`;
    const e = collection.cards[key];
    if (e) e.count += 1;
    else collection.cards[key] = { set: p.set, name: p.name, rarity: p.rarity, cn: p.cn, foil: p.foil, count: 1 };
  }
}

/* ---------- Tirage ---------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function openBooster(setId) {
  const p = pools[setId], pulls = [];
  const draw = (rarity, foil = false) => pulls.push({ ...pick(p[rarity]), foil });
  for (let i = 0; i < 7; i++) draw("Common");
  for (let i = 0; i < 3; i++) draw("Uncommon");
  for (let i = 0; i < 2; i++) draw(Math.random() < 0.125 ? "Epic" : "Rare", true); // R/E toujours foil
  const roll = Math.random();
  draw(roll < 0.50 ? "Common" : roll < 0.80 ? "Uncommon" : roll < 0.93 ? "Rare" : "Epic", true);
  pulls.push({ ...pick(runePool), foil: false });
  return pulls;
}

/* ---------- UI ---------- */
const root = dv.container.createEl("div", { cls: "rb-sim" });

const toolbar = root.createEl("div", { cls: "rb-toolbar" });
const setSelect = toolbar.createEl("select");
for (const sid of SETS) setSelect.createEl("option", { value: sid, text: `${sid} — ${SET_LABELS[sid]}` });
const countInput = toolbar.createEl("input", {
  cls: "rb-count-input", type: "number",
  attr: { min: 1, max: 36, step: 1, value: 1, title: "Nombre de boosters à ouvrir" },
});
const openBtn = toolbar.createEl("button", { cls: "rb-btn rb-btn-accent", text: "🎁 Ouvrir" });
const checkLbl = toolbar.createEl("label", { cls: "rb-check" });
const revealAll = checkLbl.createEl("input", { type: "checkbox" });
checkLbl.appendText("Tout révéler");

const ZOOM_KEY = "rb-sim-zoom";
const zoomLbl = toolbar.createEl("label", { cls: "rb-zoom", attr: { title: "Taille des cartes" } });
zoomLbl.appendText("🔍");
const zoomSlider = zoomLbl.createEl("input", {
  type: "range",
  attr: { min: 80, max: 300, step: 10, value: localStorage.getItem(ZOOM_KEY) ?? 120 },
});
const applyZoom = () => root.style.setProperty("--rb-zoom", zoomSlider.value + "px");
zoomSlider.addEventListener("input", () => { applyZoom(); localStorage.setItem(ZOOM_KEY, zoomSlider.value); });
applyZoom();

const collLine = root.createEl("div", { cls: "rb-coll-line" });
function renderCollLine() {
  collLine.empty();
  const total = Object.values(collection.boosters).reduce((a, b) => a + b, 0);
  const perSet = SETS.filter((s) => collection.boosters[s]).map((s) => `${s} ×${collection.boosters[s]}`).join(" · ");
  collLine.appendText(total ? `📦 ${total} booster${total > 1 ? "s" : ""} dans la collection (${perSet}) → ` : "📦 Collection vide → ");
  collLine.createEl("a", { text: "Booster Collection", cls: "internal-link", attr: { "data-href": "Booster Collection", href: "Booster Collection" } });
}
renderCollLine();

const packArea = root.createEl("div");

function renderCard(parent, pull, revealed) {
  const cell = parent.createEl("div", { cls: "rb-card" + (pull.foil ? " rb-foil" : "") + (revealed ? " rb-revealed" : "") });
  const inner = cell.createEl("div", { cls: "rb-card-inner" });
  const back = inner.createEl("div", { cls: "rb-face rb-back" });
  back.createEl("div", { cls: "rb-back-gem" });
  back.createEl("div", { cls: "rb-back-title", text: "RIFTBOUND" });
  const front = inner.createEl("div", { cls: "rb-face rb-front" });
  if (pull.foil) front.createEl("span", { cls: "rb-foil-star", text: "✦" });
  const img = front.createEl("img", { attr: { src: imgSrc(pull.set, pull.name), alt: pull.name, loading: "lazy" } });
  img.onerror = () => { img.replaceWith(front.createEl("div", { text: pull.name, attr: { style: "padding:8px;font-size:.75em;" } })); };
  const badge = front.createEl("span", { cls: "rb-badge", text: RARITY_FR[pull.rarity] ?? pull.rarity });
  badge.style.background = RARITY_COLOR[pull.rarity] ?? "#777";
  cell.addEventListener("click", () => cell.classList.add("rb-revealed"));
  return cell;
}

function renderPack(packs, setId) {
  packArea.empty();
  packs.forEach((pulls, i) => {
    if (packs.length > 1)
      packArea.createEl("div", { cls: "rb-pack-title", text: `Booster ${i + 1} / ${packs.length} — ${setId}` });
    const grid = packArea.createEl("div", { cls: "rb-pack" });
    for (const p of pulls) renderCard(grid, p, revealAll.checked);
  });
}

revealAll.addEventListener("change", () => {
  if (revealAll.checked)
    packArea.querySelectorAll(".rb-card").forEach((c) => c.classList.add("rb-revealed"));
});

openBtn.addEventListener("click", async () => {
  const n = Math.max(1, Math.min(36, parseInt(countInput.value, 10) || 1));
  countInput.value = n;
  const packs = [];
  for (let i = 0; i < n; i++) {
    const pulls = openBooster(setSelect.value);
    packs.push(pulls);
    addToCollection(setSelect.value, pulls);
  }
  renderPack(packs, setSelect.value);
  await saveCollection();
  renderCollLine();
});
```
