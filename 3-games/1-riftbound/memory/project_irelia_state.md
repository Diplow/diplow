---
name: Irelia, Blade Dancer — état des decks en cours
description: Deux shells en comparaison (voltron-equipment primaire, tempo-disruption référence), décision Ride the Wind en suspens
type: project
originSessionId: 45216017-9625-4aba-a870-76eec626fae5
---
Diplo construit autour de la Légende **Irelia, Blade Dancer** (Calm/Chaos) avec **Irelia, Fervent** comme Chosen Champion. Deux shells distincts sont en comparaison active :

1. **Voltron-equipment (primaire)** — boucle « choose → ready → conquer ». Apprentice Smith, Traveling Merchant, Sona Harmonious, Spirit Wheel, Doran's Ring, Seal of Focus filtrent l'équipement sur Irelia (menace primaire) et Caitlyn (menace secondaire). Split de runes 7 Calm / 5 Chaos. Workspace deck dans `decks/irelia_blade_dancer/voltron_equipment/` (`guide.md`, `list.json`, `pool.json`, `format.json`).
2. **Tempo-disruption (liste compétitive, même Légende)** — package d'interaction dense (Defy, Not So Fast, Gust, Rebuke, En Garde, Charm, Hard Bargain), menaces autonomes diversifiées (Vex, Fizz Trickster, Scuttle Crab, Stellacorn Herder, Adaptatron), équipement minimal. **Workspace créé le 2026-06-29** dans `decks/irelia_blade_dancer/tempo_disruption/` à partir d'une **liste gagnante de regional qualifier** (non créée par Diplo, importée comme variante d'étude). Runes 6 Calm / 6 Chaos. Battlefields Targon's Peak / Sunken Temple / Abandoned Hall.

**Diagnostic comparatif clé :** la liste compétitive résout la dépendance mono-menace du voltron en éparpillant les win conditions sur plusieurs corps autonomes. Le voltron garde l'avantage en matchups d'usure et en mirror via plus de génération de ressources et la portée de removal Caitlyn + Edge of Night.

**Décisions en suspens :** intégrer **Ride the Wind** (candidat test prioritaire — déclenche le choose-Might d'Irelia, la ready si exhausted, la repositionne). Priorité plus basse : Zhonya's Hourglass, 1 copie de Vex.

**Why:** La plupart des conversations deckbuilding actuelles se rattachent à cet état Irelia.
**How to apply:** Quand l'utilisateur parle deckbuilding sans préciser de légende, défaut sur ce contexte Irelia voltron. Avant de suggérer un changement, identifier de quel shell on parle. Consulter `decks/irelia_blade_dancer/voltron_equipment/list.json` (composition exacte) et `pool.json` (cartes déjà évaluées + statut, y compris les exclues) avant d'affirmer qu'une carte est ou n'est pas dans la liste, ou de proposer une carte déjà écartée.
