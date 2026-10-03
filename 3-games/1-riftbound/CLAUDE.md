# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Nature et usage

Base de travail Riftbound (TCG Riot Games / UVS Games, univers League of Legends). **Ce n'est pas une application** — c'est un dossier d'étude pour faire du deckbuilding en conversation : règles + données de cartes + scripts d'outillage + notes de design.

L'usage principal est **discuter d'un deck** : légende, plan de jeu, courbe, équilibre runes / units / spells / gears, cartes candidates. Pour que ça marche, il faut charger le bon contexte au bon moment — d'où la structure ci-dessous, pensée pour servir d'index.

## Carte du dossier

Chemins relatifs à `3-games/1-riftbound/` ; lancer les scripts depuis ce dossier.

| Chemin | Contenu | Rôle |
|---|---|---|
| `rules/riftbound_general_rules.md` | Moteur de jeu (zones, ressources, tours, combat, scoring) | Référence intemporelle |
| `rules/riftbound_keywords.md` | Mots-clés et rulings d'interaction | Référence intemporelle |
| `sets/{OGN,SFD,UNL}/source.json` | Données de cartes par extension (forme brute Riftcodex) | Source de cartes |
| `sets/{SET}/cards/images/{Card Name}.png` | Preview image par carte (w=300, depuis le CDN Sanity). Hors git : copie sur Google Drive (`Riftbound/sets`, même arborescence), à récupérer avec `rclone copy diplow:Riftbound/sets sets` ou à regénérer avec `build_card_images.py` | Hover Obsidian — `[[Card Name.png]]` |
| `sets/{SET}/cards/oracle/{Card Name}.md` | Une note par carte (frontmatter stats + image en grand + texte) | Hover sur le **nom** — `[[Card Name]]` ; source de la Base |
| `Riftbound Cards.base` | Fichier Obsidian Bases : galerie filtrable (cards + table) sur `sets/*/cards/oracle/` | « Voir tout le set d'un coup » |
| `Booster Simulator.md` | Simulateur d'ouverture de boosters (bloc `dataviewjs` — nécessite le plugin Dataview avec les requêtes JavaScript activées) ; écrit dans `booster_collection.json` à la racine | Fun / ouverture de boosters |
| `Booster Collection.md` | Galerie de la collection issue du simulateur : filtres type + rareté, zoom, reset (`dataviewjs`, lit `booster_collection.json`) | Fun / collection virtuelle |
| `scripts/riftbound_cards.py` | Fetch des cartes depuis l'API Riftcodex | Outillage data |
| `scripts/build_card_images.py` | Télécharge un `.png` preview par carte dans `sets/{SET}/cards/images/` (resumable) | Outillage assets |
| `scripts/build_card_notes.py` | Génère les notes `sets/{SET}/cards/oracle/*.md` + `Riftbound Cards.base` | Outillage assets |
| `scripts/build_pool.py` | Filtre les sets en un pool par identité de couleur / légende | Outillage deckbuilding |
| `scripts/build_list_md.py` | Génère un `list.md` visuel (grille d'images, auto-fit une page) à côté de chaque `list.json` | Outillage deck |
| `scripts/build_card_ids.py` | Génère `card_ids.json` (nom → set-id DOM, ex. `OGN-199`) à côté d'un `list.json` | Outillage /games:riftbound:play (ciblage par nom) |
| `scripts/riftbound_format_generator.py` | Fiche de légalité datée (ban list, formats, rotation) | **Single source of truth pour ce qui dépend de la date** |
| `decks/{legend}/{variant}/` | Workspace d'un deck : `format.json` (format de référence), `list.json` (liste exacte), `list.md` (grille d'images générée), `pool.json` (cartes considérées + statut), `guide.md` (plan de jeu) | Workspace deck |

Et en mémoire persistante : dossier `memory/` à la racine du projet (profil utilisateur, méthodologie, état des decks, gap de données, APIs externes, rulings acquis). Index dans `memory/MEMORY.md`, chargé automatiquement par Claude Code via une junction depuis `~/.claude/projects/.../memory/`. Les fichiers physiques vivent dans le projet pour être navigables depuis VS Code / Obsidian ; la junction garde l'auto-load fonctionnel.

## Pour quel besoin, quel fichier

| Tu veux... | Va à |
|---|---|
| Une règle moteur (zone, tour, combat, scoring) | `rules/riftbound_general_rules.md` |
| Un mot-clé ou ruling d'interaction (Equip, Quick-Draw, Tank, Deflect…) | `rules/riftbound_keywords.md` |
| La ban list / les sets légaux à une date donnée | `python scripts/riftbound_format_generator.py --format <fmt> --date <iso>` |
| Filtrer un pool autour d'une légende | `python scripts/build_pool.py --legend "<nom>"` (lit `sets/*/source.json` par défaut) |
| Le texte d'une carte précise | `sets/<SET>/source.json` correspondant à son extension |
| Le plan de jeu d'une liste existante | `decks/{legend}/{variant}/guide.md` |
| La composition exacte d'un deck | `decks/{legend}/{variant}/list.json` |
| Les cartes déjà considérées (incluses, candidates, exclues) | `decks/{legend}/{variant}/pool.json` |
| Le profil joueur, méthodologie, état actuel | mémoire (chargée automatiquement) |

## Pièges Riftbound à ne PAS re-débattre

Trois rulings contre-intuitifs déjà résolus — les appliquer directement plutôt que les ré-argumenter :

1. **Domain ≠ rune payment.** Le domaine d'une carte ne décide que de la légalité de deckbuilding. Ce qui exige des runes du bon domaine, ce sont les *pips colorés* sur les coûts en Power ou en Equip. Spirit Wheel (Chaos, coût d'énergie générique) tourne avec 12 runes Calm si la Légende inclut Chaos.
2. **Activated abilities sans `[Reaction]` / `[Action]` = Neutral speed.** Activables seulement sur ton tour, hors Showdowns et Chains. **Ce ne sont pas des combat tricks.** Pour pump en combat → `[Reaction]` spells (Discipline, Feral Strength, Defiant Dance) ou Quick-Draw equipment.
3. **Recall ≠ Move.** Recall envoie l'unité à la base sans déclencher les « when I move ». Le recall de Guardian Angel ne réveille pas Apprentice Smith. Seuls les effets qui disent *Move* explicitement (The Syren) déclenchent.

Voir aussi la mémoire `rules_traps.md` (équip = choose, Hidden, ties de combat…).

## Skills (points d'entrée)

Dans `.skills/3-games/1-riftbound/`, liées dans `.claude/skills/` par `.skills/sync` — déclenchées explicitement par `/games:riftbound:<nom>` ou automatiquement quand l'intention de la conversation matche leur description :

| Skill | Quand l'invoquer | Effet |
|---|---|---|
| **`/games:riftbound:deckbuild [legend]`** | Ouvrir une discussion deckbuilding autour d'une Légende | Charge règles + keywords + pool filtré + deck guide existant + heuristiques `deckbuilding/` |
| **`/games:riftbound:card <name>`** | Référencer une carte précise et avoir besoin du texte exact | Lookup dans `sets/*/source.json` ; flag automatique du data gap Equipment |
| **`/games:riftbound:rules <topic>`** | Question moteur (phase, zone, combat, scoring) ou keyword | Recherche dans `rules/` ; cross-check obligatoire avec `memory/rules_traps.md` |
| **`/games:riftbound:play`** | Lancer / jouer une partie sur tcg-arena.fr (simulateur manuel) | Pilote la partie via Claude-in-Chrome : setup (3 battlefields → mulligan), boucle de jeu (engager runes → pile → résoudre), journal de découverte du plateau |

Les deux sous-agents de `/games:riftbound:play` (`riftbound-strategist`, `riftbound-tactician`) vivent dans `.skills/3-games/1-riftbound/play/agents/`. Les skills consultent la mémoire (`memory/`) et `deckbuilding/` automatiquement quand pertinent.

## Heuristiques de deckbuilding

Dans `deckbuilding/` — concepts transversaux, pas spécifiques à une légende :

- `archetype_identity.md` — chaque carte au service d'un plan précis
- `threat_distribution.md` — mono-menace vs. menaces réparties

À enrichir au fil des conversations : tout raisonnement deckbuilding réutilisable au-delà du deck en cours devient un fichier ici.

## Conventions

- **Langue** : règles et code en anglais ; guides de deck, fiches de format, et discussion en français (préférence utilisateur).
- **Données datées** : ban list, sets sortis, rotations vivent **uniquement** dans `riftbound_format_generator.py`. Si un markdown les cite, c'est un signal qu'il est en train de devenir stale — corriger.
- **Nommage des previews `.png`** : le séparateur épithète des sets (` - `, ex. `Irelia - Fervent`) est réécrit en forme virgule (`Irelia, Fervent.png`) — celle utilisée dans `list.json` et les guides — pour que `[[Card Name.png]]` (ctrl+hover Obsidian) résolve directement. `/` (cartes-token `// Buff`) → `-`. Regénérer via `build_card_images.py` ; les `list.md` via `build_list_md.py`.
- **Equipment attachment-frame text** : backfillé (2026-06-29) pour les 36 Equipment SFD+UNL sous `text.equipped` (`plain` = effet reçu, `flavour`, `might` = bonus de might donné au porteur). `text.plain` reste l'active zone (coût [Equip]). Source : lecture des images de carte, pas l'API Riftcodex (qui ne capture que l'active zone). Voir `memory/project_data_gaps.md`.

## Stack

Python 3.8+ **stdlib uniquement**. Pas de venv, pas de `requirements.txt`, pas de tests, pas de build, pas de CI.

## Évolution prévue

**Palier 3** : ~~backfill equipment attachment-frame text~~ ✅ fait (2026-06-29, via images de carte → `text.equipped`). Wrappers skill optionnels pour `riftbound_format_generator.py` et `riftbound_cards.py` si l'usage le justifie. À terme : pilotage en partie via Playwright sur une plateforme de jeu en ligne.
