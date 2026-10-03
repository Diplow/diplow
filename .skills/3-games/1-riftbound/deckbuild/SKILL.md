---
name: deckbuild
description: Load full deckbuilding context for a Riftbound legend — game rules + keywords + filtered card pool + existing deck workspace if any + transverse heuristics. Use when the user opens a deckbuilding discussion around a specific legend, wants to build/refine/evaluate a list, or asks to "regarder" / "travailler sur" / "construire" a deck. Triggers include "/games:riftbound:deckbuild <legend>", "/games:riftbound:deckbuild <legend> <variant>", "on regarde Irelia ?", "fais-moi un pool pour Yasuo", "je veux retoucher le voltron". If no legend is specified, default to the active legend in memory (project_irelia_state.md).
title: deckbuild
parent: .skills/3-games/1-riftbound/deckbuild
owner: diplo
preview: >-
  Charge le contexte d'une discussion deckbuilding autour d'une légende : règles, mots-clés, workspace du deck (format, liste, pool, guide) et heuristiques transverses, puis demande par quoi commencer.
---

# Skill: deckbuild

> Chemins relatifs à `3-games/1-riftbound/` (le dossier Riftbound du repo) ; lancer les scripts depuis ce dossier.

Préparer le contexte d'une conversation deckbuilding autour d'une Légende Riftbound.

## Anatomie d'un workspace deck

Un deck vit dans `decks/{legend_slug}/{variant_slug}/` avec 4 fichiers :

- **`format.json`** — format de référence (sets légaux, ban list, structure de sideboard). Snapshot daté issu de `riftbound_format_generator.py`.
- **`list.json`** — la liste exacte (légende, chosen champion, runes, battlefields, main_deck, sideboard, totals).
- **`pool.json`** — cartes potentiellement intéressantes pour ce plan de jeu, avec un `status` (`included` / `sideboard` / `battlefield` / `candidate` / `considered` / `excluded`) et leur `role`. C'est l'**outil de réflexion deckbuilding** : sous-ensemble large des cartes légales (si une carte touche de près ou de loin au plan, elle y est).
- **`guide.md`** — le plan de jeu, les sous-moteurs, les pièges, les matchups.

Slugs en snake_case : `decks/irelia_blade_dancer/voltron_equipment/` (légende complète comme slug, variant descriptif d'archétype).

## Étapes

1. **Identifier la Légende et le variant.**
   - Parser l'argument utilisateur. Format attendu : `/games:riftbound:deckbuild [legend] [variant]` ; legend et variant peuvent être nommés en langage naturel ("le voltron Irelia").
   - **Si pas d'argument** → défaut sur la Légende active en mémoire (`memory/project_irelia_state.md`).
   - **Si seulement la légende** → lister les variants disponibles via `ls decks/<legend_slug>/`. Si un seul variant existe, le prendre par défaut. Sinon demander.
   - **Si pas de workspace existant** → demander confirmation pour en créer un nouveau (cf. étape 7).

2. **Lire la Légende en source.** Grep `sets/*/source.json` pour la légende (`"type": "Legend"` + nom matchant). Extraire couleurs (`classification.domain`) et champion tags (`tags`).

3. **Charger le workspace deck (si existant).** Lire les 4 fichiers du workspace :
   - `decks/<legend>/<variant>/format.json`
   - `decks/<legend>/<variant>/list.json`
   - `decks/<legend>/<variant>/pool.json`
   - `decks/<legend>/<variant>/guide.md`

4. **Charger les règles.** Lire `rules/riftbound_general_rules.md` et `rules/riftbound_keywords.md` — l'utilisateur peut référencer n'importe quel mot-clé ou phase sans préavis.

5. **Charger les heuristiques transversales.** Lire `deckbuilding/README.md` puis chaque fichier qui y est indexé.

6. **Pool des cartes légales (à la demande seulement).** Le `pool.json` du workspace est la sélection curatée pour ce plan ; l'ensemble exhaustif des cartes légales dans l'identité de couleur se génère via `python scripts/build_pool.py -i sets/*/source.json --legend "<name>" --slim --out /tmp/pool_legal_<slug>.json`. **Ne pas l'exécuter par défaut** — seulement quand l'utilisateur demande à étendre le `pool.json` du workspace ou à explorer hors de ce qui est déjà considéré.

7. **Création d'un nouveau workspace (si pas de deck existant).** Demander à l'utilisateur :
   - Le format ciblé (standard / casual_bo1 / sealed) → générer `format.json` depuis `riftbound_format_generator.py`.
   - Le variant slug (archétype envisagé, ex. `voltron_equipment` / `tempo_disruption` / `aggro`).
   - L'identité de jeu en une phrase → seed `guide.md`.
   - `list.json` et `pool.json` seedés vides (squelette) ou pré-remplis avec ce que l'utilisateur cite spontanément.
   - **Ne pas auto-générer la liste** : le pool se construit *après* que le plan de jeu général soit défini (préférence utilisateur).

8. **Output récapitulatif.** Une fois tout chargé, signaler à l'utilisateur sur quelques lignes :
   - Légende identifiée + couleurs + champion tags.
   - Variant chargé + composition (totals depuis `list.json` : main / side / runes / battlefields).
   - Pool : nombre de cartes par status (X included, Y candidate, Z excluded…).
   - Décisions en suspens depuis `pool.json._open_questions` ou la mémoire.
   - Puis demander **« on attaque sur quoi ? »** (refonte d'une zone / évaluation d'une carte candidate / matchup / sideboard / nouveau variant).

## Garde-fous (à appliquer pendant toute la conversation)

- **Pool ≠ list ≠ legal.** Quand on évalue une carte, vérifier d'abord dans `pool.json` si elle a déjà un statut (en particulier `excluded` — ne pas re-proposer une carte écartée sans nouvelle raison). Mettre à jour `pool.json` au fil de la discussion (changement de statut, ajout de candidate, exclusion documentée).
- **Equipment data gap** — signaler proactivement quand un Equipment est en jeu, son attachment-frame text peut manquer (`memory/project_data_gaps.md`). Ne pas deviner depuis l'active-zone text seul.
- **Rulings acquis** — appliquer directement les pièges de `memory/rules_traps.md` sans les ré-argumenter (Domain ≠ rune cost, Neutral ≠ combat trick, Recall ≠ Move, équip = choose, Hidden, ties de combat).
- **Méthode utilisateur** — une variable à la fois (`memory/feedback_methodology.md`). Préférer les propositions one-card-swap aux réécritures massives. Ne pas sur-résoudre la théorie : si une question devient floue, la nommer comme cible de playtest.
- **Identité d'archétype** — chaque suggestion de carte doit articuler **quel rôle précis** elle joue dans le plan, et **pourquoi** elle est meilleure pour ce rôle qu'une carte déjà présente (`deckbuilding/archetype_identity.md`).
- **Format datée** — la `format.json` du workspace est un snapshot. Pour vérifier la légalité courante (ban list, rotation) avant un événement, ré-exécuter `riftbound_format_generator.py` et mettre à jour le snapshot si différent.
