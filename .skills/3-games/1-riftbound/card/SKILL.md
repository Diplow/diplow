---
name: card
description: Look up a specific Riftbound card by name in sets/*/source.json — returns full text, domain, energy/might/power, type, tags, image URL. Use whenever the user references a card by name and the exact text or stats matter for the discussion. Triggers include "/games:riftbound:card <name>", "qu'est-ce que fait <name> ?", "rappelle-moi le texte de <name>", "Spirit Wheel coûte combien ?". Auto-flag Equipment cards for the known attachment-frame data gap.
title: card
parent: .skills/3-games/1-riftbound/card
owner: diplo
preview: >-
  Retrouve une carte Riftbound par son nom dans sets/*/source.json et affiche texte, domaine, coûts, type, tags et image. Signale le texte d'équipement (text.equipped) et les cartes bannies.
---

# Skill: card

> Chemins relatifs à `3-games/1-riftbound/` (le dossier Riftbound du repo) ; lancer les scripts depuis ce dossier.

Lookup ciblé d'une carte par nom dans `sets/{OGN,SFD,UNL}/source.json`.

## Étapes

1. **Recherche.** Grep insensible à la casse sur le champ `"name"` dans `sets/*/source.json`. Le nom peut être partiel.

2. **Désambiguïsation.**
   - Si match unique → étape 3.
   - Si plusieurs matches (variantes, signatures, alt-art, overnumbered, ou cartes distinctes partageant un nom) → lister les options compactes (nom complet + set + collector_number + supertype/signature flag) et demander quelle version.

3. **Présentation.** Afficher la carte avec :
   - **Nom** (+ variante si applicable : Signature, Overnumbered, Alternate Art)
   - **Set / collector_number** (ex. OGN / 142)
   - **Type / supertype / rarity** (`classification.*`)
   - **Domain** (`classification.domain`)
   - **Coûts** : `attributes.energy`, `attributes.might`, `attributes.power`
   - **Texte** (`text.plain`)
   - **Tags** (champion tags, factions)
   - **Image URL** (`media.image_url`)

4. **Warnings à émettre automatiquement.**
   - **Si `type == "Gear"` ET Equipment** → l'attachment-frame text est désormais backfillé dans `text.equipped` (`plain` = effet, `flavour`, `might` = bonus de might donné à l'unité porteuse). **L'afficher en plus de `text.plain`** : `text.plain` est l'active zone (coût [Equip]), `text.equipped` est ce que reçoit l'unité une fois équipée. Plus de data gap à flagger (cf. `memory/project_data_gaps.md`).
   - **Si la carte ressemble à un nom banni** (Called Shot, Draven (Vanquisher), Fight or Flight, Scrapheap, ou battlefields Dreaming Tree / Obelisk of Power / Reaver's Row) → confirmer via `python scripts/riftbound_format_generator.py --format standard --date $(today)` et signaler.

## Garde-fous

- Si l'utilisateur a un doute sur un keyword cité dans le texte plain, **chaîner sur la skill `/games:riftbound:rules`** plutôt que paraphraser.
- Pour un Equipment, raisonner sur **`text.equipped`** (l'effet réellement reçu par l'unité), pas seulement sur `text.plain` (le coût [Equip]).
