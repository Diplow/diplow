---
name: Gap de données — attachment-frame text des Equipment (RÉSOLU)
description: Les 36 Equipment SFD+UNL ont désormais leur attachment-frame text dans sets/*/source.json (champ text.equipped), backfillé depuis les images de carte
type: project
originSessionId: 45216017-9625-4aba-a870-76eec626fae5
---
**RÉSOLU le 2026-06-29.** Les 36 cartes Equipment (31 SFD + 5 UNL) ont maintenant leur attachment-frame text dans `sets/*/source.json`, sous la clé **`text.equipped`** :
```json
"equipped": { "plain": "<effet de règles ou ''>", "flavour": <citation ou null>, "might": <modificateur de might, entier> }
```
- `plain` = le texte d'effet du cadre d'attachement (keyword type [Tank]/[Deathknell]/[Assault N], ou trigger « When I … »). Vide `""` si l'équipement ne donne qu'un bonus de stats.
- `flavour` = présent uniquement pour les Equipment sans effet de règles (B.F. Sword, Doran's Blade, Long Sword, Sterak's Gage, Edge of Night, Blade of the Ruined King, Spinning Axe, Shepherd's Heirloom).
- `might` = le modificateur de might que l'unité porteuse gagne (la boîte en bas à droite). Pas de slot power : la boîte est toujours du might.

**Source du backfill :** lecture directe des **images de carte** (`media.image_url`, déjà dans les JSON), pas une API tierce. L'API Riftcodex ne capturait que l'active zone ; RiftScribe/Scrydex n'ont pas eu besoin d'être sondés. `build_pool.py` expose maintenant `equipped` (top-level en `--slim`, sinon imbriqué sous `text`).

**Piège résolu pendant le backfill :** le cadre d'attachement contient soit du texte de règles, soit (pour les Equipment purement +stats) une **citation flavour en italique** — ne pas confondre les deux. Voir [[rules_traps.md]].

**Reste hors-scope :** OGN n'a pas été audité (pas d'Equipment connu y nécessitant un backfill). Si de nouveaux sets sortent, refaire le même process (filtrer type Gear + keyword Equip, lire les images, patcher `text.equipped`).

---

## Gap OUVERT — set OGS hors de la couverture data (détecté 2026-06-29, précisé 2026-06-30)

La carte **Flash** (jouée 1× dans la liste tempo-disruption Irelia) était introuvable dans `sets/*/source.json`. **Identifiée le 2026-06-30 via l'image de carte fournie par Diplo** : Spell **[Reaction]**, 2 énergie générique, *« Move up to 2 friendly units to base. »*, set **OGS 011/024** (« Sugar Free », ©2025RGI).

La cause du gap n'est pas la carte mais le **set OGS** : il n'est ni dans `sets/*/source.json` ni dans `sets_legal` (OGN/SFD/UNL) du `format.json`. Comme la liste a gagné un regional qualifier, OGS est **présumé légal** → c'est notre **couverture data + le snapshot de format qui sont incomplets**.

**À faire :** (1) confirmer la légalité d'OGS dans le format standard (via `scripts/riftbound_format_generator.py` / source officielle) ; (2) si légal, fetch OGS via `scripts/riftbound_cards.py` pour compléter `sets/` ; (3) ruling à trancher : *« Move ... to base »* déclenche-t-il les when-I-move (Stellacorn) ? Le wording dit **Move** (≠ recall, cf. [[rules_traps]]), donc oui a priori, mais un move-to-base est inhabituel — cross-check `rules/`. Voir [[reference_apis]].
