---
date created: Sunday, April 12th 2026, 5:25:19 pm
date modified: Wednesday, April 15th 2026, 1:40:01 pm
---
# Plan d'évolution — Graphiked

## État actuel (12 avril 2026)

| Catégorie | Volume |
|-----------|--------|
| Vidéos ingérées | ~87 / ~607 transcripts disponibles |
| Individus | 433 |
| Organisations | 108 |
| Concepts | 198 |
| Enjeux | 7 |
| Wikilinks | ~5 279 (hors vidéos) |

Bugs connus :
- Doublon `Jean-Luc Melenchon.md` / `Jean-Luc Mélenchon.md`
- ~20 fichiers avec des wikilinks cassés ``
- Pas de versionnement (aucun repo git)

---

## Phase 1 — Fondations (priorité immédiate)

### 1.1 Initialiser le repo git

- `git init` sur le vault
- Créer un `.gitignore` (exclure `.obsidian/`, `.trash/`, éventuellement `Sources/Transcripts/` si trop lourd)
- Commit initial de l'état actuel
- Créer le repo distant (GitHub, privé ou public selon choix)
- Push initial

### 1.2 Corriger les bugs existants

- Fusionner les deux fiches Mélenchon en une seule (`Jean-Luc Mélenchon.md`), consolider le contenu, mettre à jour tous les wikilinks pointant vers l'ancienne
- Corriger tous les wikilinks `` → `[[Nom simple]]`
- Scanner les autres doublons potentiels (accents, tirets, casse)
- Commit dédié : "fix: corriger doublons et wikilinks cassés"

### 1.3 Modifier la skill d'ingestion pour le workflow git

- Chaque ingestion travaille sur une branche `ingest/TITRE-ABREGE`
- En fin d'ingestion, commit tous les changements et créer une PR
- La PR contient le résumé de l'ingestion (fiches créées, fiches enrichies, corrections ortho)
- L'utilisateur review et merge

---

## Phase 2 — Attribution et qualité (avant de reprendre l'ingestion)

### 2.1 Attribution collective par défaut

Modifier la skill :
- Remplacer la logique actuelle ("Chris dit", "Zoé dit", "Padu dit") par une attribution à "la PaduTeam" par défaut
- N'attribuer individuellement que lorsque c'est explicitement identifiable dans le transcript (segment solo, auto-identification, rôle spécifique comme "Chris qui a conçu le Graphique")
- Ajouter cette règle dans le SKILL.md

### 2.2 Skill de restructuration des fiches denses

Créer une skill `restructure-fiche` qui :
1. Prend une fiche existante (individu, concept, enjeu)
2. Relit toutes les vidéos sources référencées
3. Réorganise le contenu chronologiquement (les analyses les plus récentes en premier ou en dernier, à décider)
4. Consolide les redondances entre passages issus de vidéos différentes
5. Harmonise le ton (attribution collective, style analytique)
6. Crée une PR dédiée

Cibles prioritaires (top 15 fiches les plus denses) :
- Individus : Fabien Roussel (118l), Jordan Bardella (103l), François Ruffin (92l), Raphaël Glucksmann (87l), Marine Tondelier (85l), Jean-Luc Mélenchon (85+64l après fusion), Bruno Retailleau (82l)
- Concepts : Graphique (117l), Noisettes (87l), Moïsation (68l), Prophétie du 2002 inverse (65l)
- Enjeux : Plus jamais PS (80l), Union populaire (67l)

---

## Phase 3 — Navigation et structure (MOC + temporalité)

### 3.1 Maps of Content (MOC) thématiques

Créer un dossier `MOC/` avec des fiches-index qui servent de hubs de navigation :

- `MOC/Présidentielle 2027.md` — candidats, projections, stratégies
- `MOC/Guerre des gauches.md` — PS vs LFI, NFP, trahisons
- `MOC/Le Graphique.md` — méthodologie, applications, debunks
- `MOC/Palestine et anti-impérialisme.md` — positions géopolitiques
- `MOC/Médias et propagande.md` — analyse des médias mainstream
- `MOC/Municipales 2026.md` — résultats, analyses ville par ville
- `MOC/Féminisme matérialiste.md` — positions de Zoé, analyses genrées

Chaque MOC :
- Liste les fiches les plus pertinentes avec une phrase de contexte
- Identifie les thèses principales sur le sujet
- Sert de point d'entrée pour un lecteur qui veut comprendre "la position PaduTeam sur X"

À décider : les MOC sont-ils générés automatiquement (Dataview) ou écrits manuellement ? Manuel = plus de valeur ajoutée, plus de travail. Automatique = toujours à jour, moins de contexte.

### 3.2 Dimension temporelle

Créer des fiches chronologiques dans `MOC/` :

- `MOC/2025-S2.md` (juillet-décembre 2025)
- `MOC/2026-Q1.md` (janvier-mars 2026)
- `MOC/2026-Q2.md` (avril-juin 2026)
- etc.

Chaque fiche périodique :
- Liste les vidéos publiées dans la période
- Identifie les événements clés (élections, scandales, recompositions)
- Résume l'évolution des thèses PaduTeam sur la période
- Note les inflexions ou confirmations par rapport aux périodes précédentes

### 3.3 Renforcer l'orthogonalité enjeux / thèmes

Clarifier la distinction dans SKILL.md et CLAUDE.md :
- **Thème** = sujet d'analyse (Palestine, élections, médias). Descriptif, neutre. Répond à "de quoi ça parle ?"
- **Enjeu** = combat militant (Palestine libre, Plus jamais PS). Prescriptif, engagé. Répond à "pour quoi la PaduTeam se bat ?"

Vérifier que les enjeux actuels sont bien des combats et pas des thèmes déguisés. Candidats pour de nouveaux enjeux (à valider après scan des vidéos) :
- `féminisme-matérialiste` — position constante de Zoé sur le féminisme de classe
- `ruralité-populaire` — stratégie de conquête des territoires ruraux par la gauche de rupture
- `reconstruction-collectiviste` — le programme économique post-NFP

---

## Phase 4 — Sourcing et profondeur

### 4.1 Sourcer avec des timestamps

Modifier la skill d'ingestion pour :
- Repérer les passages clés du transcript (citations marquantes, formulations d'une thèse, moments de débat)
- Les insérer en notes de bas de page dans les fiches avec timestamp : `[^1]: [12:34] "citation exacte"`
- Optionnel : générer le lien YouTube avec timestamp si l'URL est dans l'inventaire

Commencer par les fiches denses (Phase 2) comme terrain d'expérimentation.

### 4.2 Enrichir les fiches vidéo existantes

Les 87 fiches vidéo existantes n'ont probablement pas de sourcing timestamp. Une passe de restructuration pourrait les enrichir, mais le volume est important. À évaluer si ça vaut le coût avant d'avoir terminé l'ingestion des 520 restantes.

---

## Phase 5 — Reprise de l'ingestion à grande échelle

### 5.1 Ingestion des ~520 vidéos restantes

Avec la skill mise à jour (attribution collective, PR par ingestion, timestamps), reprendre l'ingestion systématique. Prioriser :
1. Les vidéos les plus récentes (contexte 2027 le plus frais)
2. Les vidéos les plus longues / analytiques (plus de matière)
3. Les formats sous-représentés (entretiens, débats Backseat)

### 5.2 Gestion de l'hétérogénéité

Principes :
- La skill est le standard vivant : tout changement de convention passe par la skill
- Les fiches anciennes ne sont pas migrées rétroactivement sauf si une skill de migration est explicitement créée
- Le frontmatter `statut` sert de marqueur de qualité : les fiches pré-migration restent `ébauche`, les fiches post-migration montent à `développé`
- Le repo git permet de mesurer la dette technique : on peut lister les fiches qui n'ont pas été touchées depuis une migration

### 5.3 Skill de migration

Quand une convention change (ex: nouveau champ frontmatter, nouvelle section obligatoire), créer un script/skill qui :
1. Scanne toutes les fiches d'un type
2. Applique la migration (ajout de champ, restructuration de section)
3. Crée une PR unique "migrate: description du changement"

