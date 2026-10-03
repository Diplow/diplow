---
name: rules
description: Look up a Riftbound rule, keyword, or interaction in the rules/ folder. Use when the user asks how something works mechanically, when an interaction is legal, in what phase something happens, or what a keyword means. Triggers include "/games:riftbound:rules <topic>", "comment marche le Chain ?", "qu'est-ce que Deflect ?", "est-ce que Recall trigger les when-I-move ?", "à quelle phase on score ?". Always cross-check against the settled rulings in memory/rules_traps.md.
title: rules
parent: .skills/3-games/1-riftbound/rules
owner: diplo
preview: >-
  Cherche une règle, un mot-clé ou une interaction Riftbound dans rules/, recoupée avec les rulings acquis de memory/rules_traps.md. La légalité datée passe par riftbound_format_generator.py.
---

# Skill: rules

> Chemins relatifs à `3-games/1-riftbound/` (le dossier Riftbound du repo) ; lancer les scripts depuis ce dossier.

Recherche dans le moteur de jeu et les mots-clés Riftbound.

## Étapes

1. **Identifier la portée.**
   - **Keyword ou ruling d'interaction** (Equip, Quick-Draw, Tank, Deflect, Shield, Hunt, Deathknell, Hidden, Stun, Ganking, Buff, Mighty, Accelerate, Assault, Temporary…) → `rules/riftbound_keywords.md`.
   - **Concept moteur** (phase, zone, ressource, mulligan, targeting, Chain, Showdown, Combat, Conquer, Hold, scoring) → `rules/riftbound_general_rules.md`.
   - **En cas de doute** → chercher dans les deux.

2. **Grep et extraction.** Chercher le terme. Retourner la section pertinente avec son contexte immédiat (titre de section + 5-15 lignes utiles), pas le fichier entier.

3. **Cross-check obligatoire avec les pièges acquis** (`memory/rules_traps.md`). Si le topic touche un des points suivants, **citer directement la mémoire** plutôt que de ré-argumenter :
   - Domain vs. rune payment (pip coloré)
   - Activated abilities Neutral speed ≠ combat tricks
   - Recall ≠ Move (pas de trigger "when I move")
   - Attacher Equipment (Equip / Quick-Draw) = "choose a friendly unit" ; Weaponmaster non
   - Hidden cards : présence d'unité amie requise
   - Combat ties : attaquant recall

4. **Si réellement introuvable.** Pointer vers les sources officielles : [Rules Hub](https://playriftbound.com/en-us/rules-hub/) et le Riftbound FAQ communautaire (riftboundfaq.com). Ne pas inventer une règle.

## Garde-fous

- Pour toute question de **légalité datée** (ban list, sets en rotation, format) → ne PAS chercher dans `rules/`, exécuter `python scripts/riftbound_format_generator.py --format <fmt> --date <iso>` à la place. C'est la single source of truth.
