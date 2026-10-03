# Deck — Irelia, Blade Dancer (Calm / Chaos) — tempo-disruption

> Guide de pilotage pour **cette liste précise**. Importée le 2026-06-29.
> **Provenance** : liste gagnante d'un *regional qualifier* (tournoi compétitif), non créée par Diplo — variante d'étude. Décode le shell « tempo-disruption » référencé dans `memory/project_irelia_state.md` et `deckbuilding/threat_distribution.md`.
> Fichiers compagnons : [`list.json`](list.json) · [`pool.json`](pool.json) · [`format.json`](format.json).
> Règles génériques : [`../../../rules/riftbound_general_rules.md`](../../../rules/riftbound_general_rules.md) · [`../../../rules/riftbound_keywords.md`](../../../rules/riftbound_keywords.md).

## Identité

**Tempo-disruption** : on protège Irelia avec un **mur d'interaction** (counters + removal tempo + tricks Reaction) tout en posant des **menaces autonomes diversifiées** (Vex, Fizz, Scuttle Crab, Stellacorn, Adaptatron). Là où le `voltron_equipment` met *tous* ses œufs sur Irelia équipée, ce build **répartit les menaces** — il résout structurellement la dépendance mono-menace (`threat_distribution.md`) au prix du plafond de grind. Irelia reste le finisher, mais elle n'est pas le seul plan.

- **Légende** : Irelia, Blade Dancer (Calm/Chaos) — *choose une unité amie → exhaust + 1 rune → la ready ; quand tu conquiers → 1 énergie → ready la Légende.*
- **Chosen Champion** : Irelia, Fervent — *quand tu la choose OU la ready → +1 Might ce tour ; Deflect.*
- **Runes** : 6 Calm / 6 Chaos (plus chaos-lourd que le voltron 7/5 — porté par le paquet d'interaction Chaos).

## Gameplan (résumé pilote)

> **Tout le plan tient en une phrase : protéger Irelia.** Ne la gaspille pas trop tôt — ne la pose/engage que quand tu peux la protéger.

Scénario idéal :
1. **Points tôt** avec un corps 2-coût, OU un premier play Guardian Angel / Zhonya's.
2. **Draw dans un Stellacorn Herder**, gear-up pour piocher, prépare la fermeture avec Irelia.
3. **Mène aux points avec de la pression**, puis verrouille.

Repères de pilotage :
- **Vex, Apathetic** : excellente pour **tenir un battlefield** aussi longtemps que nécessaire — surtout contre **accelerate oppressif, sprites, reflection**. Mais **ne pas surengager** : ne la perds pas bêtement.
- **2 copies de Stellacorn Herder** (pas 3) : choix assumé, le draw de Scuttle Crab / lonely poro compense. En test, « feels good ».
- **Ride the Wind & Flash** : sauvent tes unités d'un trade (esquive le recall de combat nul), OU **volent 2 points** — pendant que l'adversaire est tapé out tu défends un field puis **gank sur un autre** pour un hold supplémentaire.
- **Ready Irelia intelligemment** avec tes buffs / Flash → tu peux toujours **revenir en base** (back in).

## Le mur d'interaction — apprendre à counter

Le deck contient **beaucoup de counterspells**. La compétence centrale : **savoir quand et lequel** utiliser.

- **Defy** (Reaction, Calm) — counter ciblé bon marché, pilier anti-removal/trick.
- **Not So Fast** (Reaction, Calm) — counter **ce qui choose une unité/gear ami** : bouclier dédié quand on cible Irelia.
- **Hard Bargain** (Reaction, Chaos, [Repeat]) — taxe : counter sauf paiement 2 én. Passe sous les mains tapées.

> Conseil pilote : parfois **laisse passer** un trade (ex. l'adversaire détruit le gear attaché) pour **garder ton counter** contre un sort plus important — tu ré-attacheras pour re-sécuriser ton unité plus tard.

Removal tempo (déplace / renvoie plutôt que tuer) :
- **Gust** (Reaction, Chaos) — bounce ≤3 Might à un battlefield. Vs early aggro / blockers.
- **Charm** (Calm) — move an enemy unit : l'attire où on la bat, ou désengage un holder.
- **Rebuke** (Action, Chaos) — return une unité à un battlefield en main. Removal dur. *Action* (ton tour / showdown, pas un trick au tour adverse).

Tricks de combat (vrais [Reaction], cf. `rules_traps.md`) :
- **Discipline** (+2 Might + draw + choose), **Defiant Dance** (+2/-2 + choose), **En Garde** (+1, +1 de plus si seul).

## Menaces autonomes (threat-spread)

On n'a pas besoin de **LA** bonne carte — juste **assez** de corps :
- **Vex, Apathetic** (Chaos E4 M4, Deflect) — stun toute unité adverse jouée pendant qu'elle tient un field. Holdeuse + frein anti-développement.
- **Fizz, Trickster** (Chaos E3 M3) — rejoue un sort du trash (≤3 én., ignore coût d'énergie). Valeur + relance d'un counter/trick.
- **Scuttle Crab** (Calm E2 M0) — draw on play ; M0 peut conquer/hold gratuitement. Holder + cantrip. 3 copies.
- **Stellacorn Herder** (Calm E4 M3) — when I move, draw 1 (rallumé par Ride the Wind / Tideturner). Avantage de cartes.
- **Adaptatron** (Calm E4 M3) — conquer → kill un gear pour se buffer (+1 Might récurrent). Grandit en scorant.

## Mobilité — move / save

- **Tideturner** (Chaos E2 M2, Hidden) — swap de position avec un ami à un autre lieu. Reposition + choose-trigger. 3 copies.
- **Ride the Wind** (Action, Chaos) — Move un ami ET le ready. Sur Irelia : choose + ready (double +1 Might) + reposition + déclenche les move-loot (Stellacorn). Sauve d'un trade.
- **Flash** (Spell **[Reaction]**, 2 én. générique — *Move up to 2 friendly units to base*) — le **save instantané**. Contrairement à Ride the Wind (Action), Flash se joue **en plein combat, avant résolution** : sort Irelia (ou 2 corps) d'un trade perdant à vitesse réaction. Dit **« Move »** (≠ recall) → déclenche a priori les **when-I-move** (Stellacorn draw) + un **choose** sur Irelia Fervent (+1 Might). Contrepartie : les unités partent en base (perte de présence/hold). *Set OGS 011/024 — hors de notre data ; légalité OGS et ruling move-to-base à confirmer.*

## Battlefields (1 par game, chosen)

- **Abandoned Hall** — chaque sort joué → +1 Might à une unité ici. *Self-explanatory* vu le nombre de sorts. **Souvent posé Game 1** (dépend du MU).
- **Sunken Temple** — conquer ici avec 1+ unité **Mighty (5+)** → payer 1 én. → draw 1. Parfait **vs decks sans gros Might**. Idéalement **Game 2** (dépend du MU).
- **Targon's Peak** — conquer → ready 2 runes en fin de tour. **Going first après Game 1** : avantage de runes en restançant 2 après un play T2. **Optimal : un 2-drop unit T1.**

## Sideboard

8 cartes — sideboard ciblé selon le profil adverse :
- **2 Find Your Center** — IN going-second vs decks lents (on peut ralentir) ; **OUT 2x Scuttle Crab**. **Pas** recommandé vs high-pressure / tempo.
- **2 Adaptatron** — porte le total à 3 ; vs MU où le grind via conquer-buff paie.
- **2 Star-Crossed** (Reaction, Chaos) — bounce un ami **et** un ennemi : sauve Irelia + retire une menace.
- **1 Gust** — porte le total à 3, vs **gear-heavy** ou cibles ≤3 Might (ex. **LeBlanc / Yi**).
- **1 Heart of Dark Ice** — +3 Might répétable (Neutral, pas un trick) : rend une unité Mighty (synergie Sunken Temple) ou pousse un score.

> Rappel : **runes, Légende, battlefields ne changent PAS** en sideboarding. Le rune deck 6/6 doit supporter main + SB.
> Going-second : **-2 Scuttle Crab / +2 Find Your Center**, seulement si tu peux jouer plus lentement.

## Pièges de pilotage (rulings — voir `memory/rules_traps.md`)

- **Action ≠ Reaction** : Ride the Wind, Rebuke, Charm sont des **Actions** (ton tour / showdown) — **pas** des tricks au tour adverse. Tes vrais tricks de combat : Discipline, Defiant Dance, En Garde (Reaction).
- **Combat nul** (les deux camps gardent des unités) → les attaquants sont **recall**. N'engage Irelia que si tu peux *gagner*, sinon utilise Ride the Wind / Flash / Star-Crossed pour la sortir avant.
- **Hidden** (Tideturner, Zhonya's) : on ne cache qu'à un battlefield contrôlé avec un ami dessus ; part au cleanup si tu perds ta présence.
- **Recall ≠ Move** : le recall de Guardian Angel / Zhonya's ne déclenche **pas** les « when I move » (Stellacorn). Seul un *Move* explicite (Tideturner, Ride the Wind) le fait.

## Matchups (à étoffer avec des reps)

> Le pilote source note que les matchups sont à approfondir. Squelette de départ :
- **Vs accelerate / sprites / reflection** : Vex Apathetic hold prioritaire (stun les unités jouées).
- **Vs gear-heavy** : +1 Gust (total 3) ; Adaptatron mange leurs gears en conquérant.
- **Vs LeBlanc / Yi** : Gust (bounce les corps ≤3 Might).
- **Vs slow / contrôle, going second** : -2 Scuttle Crab / +2 Find Your Center.

## Faiblesses connues

- **Plafond de grind plus bas** que le voltron : pas de moteur de runes Sona ni de boucle équipement gourmande. On gagne par **tempo + territoire + interaction**, pas par l'attrition exponentielle.
- **Exécution exigeante** : la valeur du deck est dans le **timing des counters** — un counter mal dépensé (ou gardé trop longtemps) coûte la game.
- **Flash hors data** : carte identifiée (OGS 011/024) mais absente de `sets/*/source.json` et de `sets_legal`. Deux points ouverts : légalité du set OGS, et le ruling « move-to-base déclenche-t-il les when-I-move ? ». Tant que non tranchés, garder une réserve sur ces lignes.
