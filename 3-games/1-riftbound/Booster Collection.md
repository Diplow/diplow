# 📦 Collection

> [!info]- Comment ça marche
> Galerie de toutes les cartes tirées via le [[Booster Simulator]], groupées par set et triées par rareté puis numéro de collection. Filtres combinables par **type** et **rareté**, badge `×N` pour les exemplaires multiples, liseré doré pour les foils. Les données vivent dans `booster_collection.json` — le bouton **♻️ Réinitialiser** (double clic de confirmation) remet tout à zéro. Si la note était déjà ouverte pendant que tu ouvrais des boosters, clique sur **🔄 Rafraîchir**.

```dataviewjs
/* ============ Collection de boosters Riftbound ============ */

const SETS = ["OGN", "SFD", "UNL"];
const SET_LABELS = { OGN: "Origins", SFD: "Spiritforged", UNL: "Unleashed" };
const BASE = dv.current().file.folder;
const COLLECTION_PATH = `${BASE}/booster_collection.json`;
const RARITY_ORDER = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3 };
const RARITY_FR = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Epic: "Épique" };

/* ---------- Styles ---------- */
const style = document.createElement("style");
style.textContent = `
.rb-coll { font-family: var(--font-interface); }
.rb-btn { padding:6px 14px; border-radius:8px; cursor:pointer; border:1px solid var(--background-modifier-border);
  background:var(--interactive-normal); font-weight:600; }
.rb-btn:hover { background:var(--interactive-hover); }
.rb-btn-danger { color:#e57373; }
.rb-btn-danger.rb-armed { background:#c62828; color:white; border-color:#c62828; }
.rb-zoom { display:flex; align-items:center; gap:6px; user-select:none; }
.rb-zoom input[type=range] { width:130px; }

.rb-coll-head { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:6px 0 4px; }
.rb-coll-stats { color:var(--text-muted); font-size:.9em; }
.rb-filters { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 4px; }
.rb-chip { padding:2px 11px; border-radius:12px; cursor:pointer; font-size:.82em; font-weight:600;
  border:1px solid var(--background-modifier-border); background:var(--interactive-normal); user-select:none; }
.rb-chip:hover { background:var(--interactive-hover); }
.rb-chip.rb-active { background:var(--interactive-accent); color:var(--text-on-accent); border-color:var(--interactive-accent); }

.rb-coll-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(var(--rb-zoom, 92px), 1fr)); gap:6px; margin:8px 0 18px; }
.rb-thumb { position:relative; border-radius:5px; overflow:hidden; }
.rb-thumb img { width:100%; display:block; border-radius:5px; }
.rb-thumb .rb-count { position:absolute; bottom:3px; right:3px; background:rgba(0,0,0,.78); color:white;
  font-size:.68em; font-weight:700; padding:0 6px; border-radius:8px; }
.rb-thumb.rb-foil { box-shadow:0 0 0 2px #c9a227; }
.rb-foil-star { position:absolute; top:4px; left:6px; color:#ffd750; text-shadow:0 0 4px #000; font-size:.9em; z-index:2; }
.rb-set-title { margin:14px 0 2px; font-weight:700; font-size:1.05em; }
.rb-empty { color:var(--text-muted); font-style:italic; margin:10px 0 20px; }
`;
dv.container.appendChild(style);

/* ---------- Données ---------- */
function cardFile(setId, name) {
  let stem = name.split(" - ").join(", ");
  for (const ch of '<>:"/\\|?*') stem = stem.split(ch).join("-");
  return `${BASE}/sets/${setId}/cards/images/${stem.trim()}.png`;
}
const imgSrc = (setId, name) => app.vault.adapter.getResourcePath(cardFile(setId, name));

const typeMap = {}; // "SET|name" -> catégorie (type, avec Unit+Champion => "Champion")
for (const sid of SETS) {
  const raw = JSON.parse(await app.vault.adapter.read(`${BASE}/sets/${sid}/source.json`));
  for (const c of raw)
    typeMap[`${sid}|${c.name}`] =
      (c.classification.type === "Unit" && c.classification.supertype === "Champion") ? "Champion" : c.classification.type;
}
const typeOf = (c) => typeMap[`${c.set}|${c.name}`] ?? "?";

async function loadCollection() {
  try {
    if (await app.vault.adapter.exists(COLLECTION_PATH))
      return JSON.parse(await app.vault.adapter.read(COLLECTION_PATH));
  } catch (e) { console.error("Booster collection illisible", e); }
  return { boosters: {}, cards: {} };
}
let collection = await loadCollection();

/* ---------- UI ---------- */
const root = dv.container.createEl("div", { cls: "rb-coll" });
const collHead = root.createEl("div", { cls: "rb-coll-head" });

function makeFilterBar(options, onSelect) {
  const bar = root.createEl("div", { cls: "rb-filters" });
  for (const [value, label] of options) {
    const chip = bar.createEl("span", { cls: "rb-chip" + (value === options[0][0] ? " rb-active" : ""), text: label });
    chip.dataset.value = value;
    chip.addEventListener("click", () => {
      bar.querySelectorAll(".rb-chip").forEach((c) => c.classList.toggle("rb-active", c.dataset.value === value));
      onSelect(value);
      renderCollection();
    });
  }
  return bar;
}

let collFilter = "Tous";
makeFilterBar(
  ["Tous", "Champion", "Unit", "Spell", "Gear", "Legend", "Battlefield", "Rune"].map((t) => [t, t]),
  (v) => { collFilter = v; }
);

let rarityFilter = "Toutes";
makeFilterBar(
  [["Toutes", "Toutes"], ...Object.keys(RARITY_ORDER).map((r) => [r, RARITY_FR[r]])],
  (v) => { rarityFilter = v; }
);

const collArea = root.createEl("div");

function renderCollection() {
  collHead.empty();
  collArea.empty();
  const boosterTotal = Object.values(collection.boosters).reduce((a, b) => a + b, 0);
  const cards = Object.values(collection.cards);
  const cardTotal = cards.reduce((a, c) => a + c.count, 0);

  const perSet = SETS.filter((s) => collection.boosters[s])
    .map((s) => `${s} ×${collection.boosters[s]}`).join(" · ");
  collHead.createEl("span", {
    cls: "rb-coll-stats",
    text: boosterTotal
      ? `${boosterTotal} booster${boosterTotal > 1 ? "s" : ""} (${perSet}) — ${cardTotal} cartes, ${cards.length} entrées uniques`
      : "Aucun booster ouvert pour l'instant.",
  });

  const refreshBtn = collHead.createEl("button", { cls: "rb-btn", text: "🔄 Rafraîchir" });
  refreshBtn.addEventListener("click", async () => { collection = await loadCollection(); renderCollection(); });

  const resetBtn = collHead.createEl("button", { cls: "rb-btn rb-btn-danger", text: "♻️ Réinitialiser" });
  let armed = false, timer = null;
  resetBtn.addEventListener("click", async () => {
    if (!armed) {
      armed = true;
      resetBtn.classList.add("rb-armed");
      resetBtn.textContent = "Confirmer la remise à zéro ?";
      timer = setTimeout(() => { armed = false; resetBtn.classList.remove("rb-armed"); resetBtn.textContent = "♻️ Réinitialiser"; }, 4000);
      return;
    }
    clearTimeout(timer);
    collection = { boosters: {}, cards: {} };
    await app.vault.adapter.write(COLLECTION_PATH, JSON.stringify(collection, null, 2));
    renderCollection();
  });

  const ZOOM_KEY = "rb-coll-zoom";
  const zoomLbl = collHead.createEl("label", { cls: "rb-zoom", attr: { title: "Taille des cartes" } });
  zoomLbl.appendText("🔍");
  const zoomSlider = zoomLbl.createEl("input", {
    type: "range",
    attr: { min: 60, max: 300, step: 10, value: localStorage.getItem(ZOOM_KEY) ?? 92 },
  });
  const applyZoom = () => root.style.setProperty("--rb-zoom", zoomSlider.value + "px");
  zoomSlider.addEventListener("input", () => { applyZoom(); localStorage.setItem(ZOOM_KEY, zoomSlider.value); });
  applyZoom();

  if (!boosterTotal) {
    collArea.createEl("div", { cls: "rb-empty", text: "Collection vide — ouvre ton premier booster dans Booster Simulator !" });
    return;
  }
  let shown = 0;
  for (const sid of SETS) {
    const setCards = cards.filter((c) => c.set === sid)
      .filter((c) => collFilter === "Tous" || typeOf(c) === collFilter)
      .filter((c) => rarityFilter === "Toutes" || c.rarity === rarityFilter)
      .sort((a, b) => (RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]) || (a.cn - b.cn) || (a.foil ? 1 : -1));
    if (!setCards.length) continue;
    shown += setCards.length;
    const n = setCards.reduce((a, c) => a + c.count, 0);
    collArea.createEl("div", { cls: "rb-set-title", text: `${sid} — ${SET_LABELS[sid]} (${n} cartes)` });
    const grid = collArea.createEl("div", { cls: "rb-coll-grid" });
    for (const c of setCards) {
      const th = grid.createEl("div", { cls: "rb-thumb" + (c.foil ? " rb-foil" : ""), attr: { title: `${c.name}${c.foil ? " (foil)" : ""} — ${typeOf(c)}, ${RARITY_FR[c.rarity] ?? c.rarity}` } });
      th.createEl("img", { attr: { src: imgSrc(c.set, c.name), alt: c.name, loading: "lazy" } });
      if (c.foil) th.createEl("span", { cls: "rb-foil-star", text: "✦" });
      th.createEl("span", { cls: "rb-count", text: `×${c.count}` });
    }
  }
  if (!shown)
    collArea.createEl("div", { cls: "rb-empty", text: "Aucune carte ne correspond aux filtres." });
}

renderCollection();
```
