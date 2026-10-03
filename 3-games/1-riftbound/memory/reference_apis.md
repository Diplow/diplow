---
name: APIs externes de données Riftbound
description: Sources externes pour les données de cartes — Riftcodex (primaire), RiftScribe / Scrydex (candidats backfill)
type: reference
originSessionId: 45216017-9625-4aba-a870-76eec626fae5
---
- **Riftcodex** — `https://api.riftcodex.com` (pas de préfixe `/api/`). Gratuit, no-auth, taille de page max 100. Source primaire utilisée par `scripts/riftbound_cards.py`. **Limite connue :** ne capture que l'active zone de l'Equipment, pas l'attachment-frame text.
- **RiftScribe** — `https://riftscribe.gg/api/cards/{id}`. REST public, no auth. Candidat backfill pour l'attachment-frame text d'Equipment. Accès automatisé bloqué dans les anciens environnements sandbox Claude — exécuter localement ou via web_fetch.
- **Scrydex** — `https://api.scrydex.com`. Requiert une clé API gratuite + Team ID. Champ `rules` array structurellement adapté aux cartes multi-section (Equipment notamment). Candidat backfill de secours.

**Note de schéma Riftcodex JSON :** `card.classification.domain` peut être string ou liste — à normaliser. Type et rareté à `classification.type` / `classification.rarity`. Pas de champ explicite pour le statut d'attachement de l'Equipment ; détection via type ou tags.
