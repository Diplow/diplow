# Deck — Irelia, Blade Dancer (Calm / Chaos) — voltron-equipment

> Guide de pilotage pour **cette liste précise**. Compilé le 2026-06-28.
> Fichiers compagnons : [`list.json`](list.json) (liste exacte), [`pool.json`](pool.json) (réflexion deckbuilding), [`format.json`](format.json) (légalité de référence).
> Règles génériques : [`../../../rules/riftbound_general_rules.md`](../../../rules/riftbound_general_rules.md) et [`../../../rules/riftbound_keywords.md`](../../../rules/riftbound_keywords.md).

## Identité

**Voltron-tempo equipment** bâti autour d'Irelia, avec un **moteur de sélection** (loot/draw) et des **menaces équipées secondaires**. On ne cherche pas à submerger le board : on rend Irelia incontournable, on l'utilise pour conquérir/tenir en boucle, et on met assez de pression annexe (corps équipés) pour forcer l'adversaire à se disperser et **ouvrir l'espace pour la poser en sécurité**.

- **Légende** : Irelia, Blade Dancer (Calm/Chaos) — *choose une unité amie → exhaust + 1 rune → la ready ; quand tu conquiers → 1 énergie → ready la Légende.*
- **Chosen Champion** : Irelia, Fervent — *quand tu la choose OU la ready → +1 Might ce tour ; Deflect.*

## Liste

Voir [`list.json`](list.json) pour la composition exacte (main 40 + side 8 + 12 runes + 3 battlefields).

## Le moteur central — la boucle « choose → ready → conquer »

Tout part de **choisir une unité amie**. Compte comme « choose » : un sort qui la cible, **l'attache d'un équipement** (Equip ou Quick-Draw), **la déplacer** (Syren « move », Tideturner « choose a unit »). Sur Irelia :

1. Le **choose** → Irelia **+1 Might** (son texte).
2. La **Légende** → exhaust + 1 rune → **ready Irelia** → comme elle transitionne d'exhausted à ready, **+1 Might** encore.
3. **Spirit Wheel** (si en jeu) → 1 énergie + exhaust → **pioche 1**.
4. Irelia, de nouveau ready, **re-bouge / re-attaque**. Quand elle **conquiert** → 1 énergie → **ready la Légende** → on peut reboucler.
5. La conquête déclenche aussi **Doran's Ring** (loot) et **Zaun Warrens** (loot) si en jeu.

> ⚠️ Le +1 « ready » ne tombe **que si Irelia était exhausted** au moment du choose. Et la Légende ne ready qu'une fois par disponibilité (rallumée en conquérant pour 1 énergie).

## Les sous-moteurs

**Sélection / filtrage (trouver les pièces, jeter les doublons).** Apprentice Smith (move → pioche un gear, sinon recycle), Traveling Merchant (move → loot), Doran's Ring + Zaun Warrens (conquer → loot), Spirit Wheel + Discipline (vraie pioche).

**The Syren** est l'activateur : elle *Move* un corps ami vers la base → re-déclenche les « when I move » de Merchant/Smith (et peut **sauver Irelia** d'un combat perdant). C'est du **filtrage massif** : ça creuse vers Irelia/équipements et défausse les doublons — ce qui **justifie les nombreux x3** (les copies en trop deviennent du carburant à jeter).

**Runes.** **Sona** (×3) est le vrai moteur : *ready jusqu'à 4 runes en fin de ton tour si elle est à un battlefield* — soit ~6 runes/tour avec ton channel de base, ce qui fait tourner la boucle (gourmande) et permet de réagir au tour adverse. **Seal of Focus** (0 énergie / 1 Power, **Reaction**) complète : fixation Calm flexible, activable même au tour adverse.

**Protection d'Irelia.** Deflect natif + **Guardian Angel** (si elle allait mourir : tue le gear à la place, soin/exhaust/recall) + counters (Defy, Not So Fast au SB).

## Courbe & séquençage type

Courbe très basse. Repères :
- **0 én. (1 Power)** : Seal of Focus (en Reaction). **1 én.** : Doran's Ring, Defiant Dance, Defy.
- **2 én.** : Discipline, Apprentice Smith, Traveling Merchant, The Syren, Spirit Wheel, Tideturner, Feral Strength.
- **2-3 én.** : Guardian Angel (E2 + equip), Edge of Night (E3 ou 1 Power via Hidden), Boots (E3), Caitlyn (E3).
- **4 én.** : Sona. **5 én.** : Irelia.

Plan de match :
- **T1-T2** : poser des corps qui font avancer le plan sans Irelia — Apprentice Smith / Traveling Merchant (puis les *bouger* pour looter), Spirit Wheel (moteur tôt), Sona dès que possible. Commencer à équiper pour mettre une pression annexe.
- **T3 (6 runes)** : **poser Irelia ET la débloquer le même tour** — pose-la (exhausted), puis *choose-la* (Discipline / Defiant Dance / une attache) → la Légende la ready → elle peut bouger/attaquer immédiatement. C'est la ligne-clé du deck.
- **T4+** : boucler (choose → ready → conquer → ready Légende), empiler les équipements, scorer en Conquer puis verrouiller en Hold.

## Combos & interactions notables

- **Edge of Night via Hidden** : sur un terrain que tu contrôles, cache-le (1 Power) ; au tour suivant, joue-le en **Reaction** → +2 Might permanent **+ un choose**, pour un coût étalé. Idéal en plein combat.
- **Boots + readies** : Ganking sur Irelia → conquiers un field, ready la Légende (1 én.), repars conquérir le second.
- **Caitlyn équipée** = canon à removal : son ping vaut sa Might. Edge of Night (+2) + Doran's Ring (+1) → Caitlyn 6 Might qui descend presque tout, **Backline** (protégée). Force l'adversaire à la gérer → ouvre Irelia.
- **Tideturner / Syren** : repositionnent (propulser un corps frais au front, ou rapatrier une unité menacée) **en déclenchant un choose**.
- **Abandoned Hall** : chaque sort joué → +1 Might à une unité ici (s'empile avec ton paquet de Reactions).

## Pièges de pilotage (rulings à ne pas oublier)

- **Une capacité activée sans [Reaction] n'est PAS un combat trick** : tes vrais tricks de combat sont **Discipline, Defiant Dance, Feral Strength** (Reaction) et les équipements **Quick-Draw**. Garde-les pour le showdown.
- **Recall ≠ Move** : le **recall de Guardian Angel** « n'est pas un move » → il **ne déclenche pas** les « when I move » d'Apprentice/Merchant. **The Syren** (qui dit *Move*), si.
- **Hidden** (Edge of Night, Tideturner) : on ne cache **qu'à un battlefield qu'on contrôle, avec une unité amie dessus** ; la carte **part au cleanup** si tu perds ta présence. → Outil de « quand tu es installé », pas un filet quand tu perds le board, ni un play de T1.
- **Combat nul** (les deux camps gardent des unités) → **les attaquants sont recall**. Anticipe : n'engage Irelia que si tu peux *gagner* le combat, sinon elle rentre en base (et tu perds le Hold).
- **Égalité de couleur** : tes 5 Chaos servent à équiper Doran's Ring / Edge of Night / Boots (coûts Equip [chaos]). Tideturner, Syren, Merchant, Spirit Wheel sont « Chaos » mais se jouent en Calm.

## Mulligan

Cherche une ouverture qui **courbe** : au moins un corps 2-coût jouable T1 (Apprentice Smith / Traveling Merchant / Spirit Wheel) et idéalement de quoi enchaîner (Sona, un fixateur). **Sona est une garde prioritaire.** Évite les mains lourdes en équipements sans porteur. Tu n'as pas besoin d'Irelia en main d'ouverture (elle est garantie en Champion Zone) — tu mulligan pour le *setup*, pas pour elle.

## Matchups & sideboard

- **Vs contrôle / removal** (ils veulent tuer Irelia) : **+3 Not So Fast** (counter ce qui choisit tes unités/gear), garder Defy. Sortir du filtrage excédentaire / Boots / une Tideturner.
- **Vs aggro / board / gros Might** (ils t'ignorent et prennent le terrain) : **+2 Charm** (attire une unité sur un terrain où tu la bats = removal conditionnel), **+1 Caitlyn** (removal-engine), **+1 Feral Strength**. Sortir le gear le plus lent / Spirit Wheel.
- Rappel : **runes, Légende et battlefields ne changent PAS** en sideboarding ; ton rune deck (7/5) doit supporter main + SB. Échanges 1-pour-1 entre games.

## Faiblesses connues

- **Mono-menace** : si Irelia est neutralisée malgré Deflect + Guardian Angel + counters (typiquement par un **plus gros Might** non ciblé), tu perds ton moteur principal. Le plan B (Merchant/Caitlyn équipés + filtrage) existe mais reste secondaire.
- **Embouteillage de ressources** : beaucoup d'activations (Légende, Spirit Wheel, Seal, équipements colorés) se disputent énergie/exhaust. **Sona est ce qui fluidifie** — la protéger et la déployer tôt est souvent prioritaire.
- **Filtrage ≠ avantage de cartes** : tu trouves tes pièces fiablement, mais tu ne *submerges* pas l'adversaire en cartes. Gagne par le tempo et le territoire, pas par l'attrition pure.
