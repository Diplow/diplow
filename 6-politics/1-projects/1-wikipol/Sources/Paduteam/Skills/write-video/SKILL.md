---
name: write-video
description: >
  Rédige ou enrichit une fiche Videos/ à partir d'un transcript analysé et du contexte vault.
  Appelée par ingest-video après l'analyse du transcript et le gather-context.
  Peut aussi être appelée directement pour réécrire/améliorer une fiche vidéo existante.
date created: Sunday, April 12th 2026, 7:00:00 pm
date modified: Monday, April 20th 2026, 1:27:51 pm
---

# Skill : Write Video

## Vue d'ensemble

Cette skill rédige ou enrichit une fiche dans `Videos/`. C'est la fiche-pivot de l'ingestion : elle lie le transcript source à toutes les entités, concepts et enjeux identifiés.

## Prérequis

- Le transcript a été lu et analysé (thèses, métadonnées, entités identifiées)
- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` sur le sujet de la vidéo. Si ce fichier n'existe pas, ne concerne pas ce sujet, ou paraît périmé, **interrompre** et demander à l'appelant de lancer `gather-context` d'abord. Ne pas tenter de l'exécuter soi-même.

**Conventions partagées** : voir `BUILD.md`.

## Navigation de la carte de contexte

`.context-tmp.md` est une **carte** : présentation synthétique + liens annotés vers les fiches pertinentes. Elle ne contient pas les détails. Pour rédiger une fiche Vidéo, **ouvrir les fiches Concepts/Enjeux liées** avant de choisir les wikilinks du corps — cela garantit que les liens pointent vers des fiches au contenu réellement cohérent avec la thèse de la vidéo. Pour les listes d'entités en bas, vérifier que les fiches existantes correspondent au bon sens (alias, homonymes) en ouvrant la fiche Individu/Organisation si doute.

---

## Entrée

- **Transcript analysé** : titre, date, intervenants, domaine, format, liste des entités/concepts/enjeux identifiés, thèses principales
- **Contexte vault** : `Sources/.context-tmp.md`

## Sortie

Une fiche `Videos/TITRE ABRÉGÉ.md` créée ou enrichie.

---

## Workflow

### Étape 1 — Vérifier si la fiche existe

Chercher dans `Videos/` un fichier correspondant au titre. Si la fiche existe, la lire — c'est un enrichissement, pas une création.

### Étape 2 — Rédiger la fiche

#### Template

```markdown
---
type: vidéo
domaine: [valeur1]
thèmes: [thème1, thème2]
enjeux: [enjeu1, enjeu2]
date: YYYY-MM-DD
youtube_id: "XXXXXXXXXXX"
skill_version: write-video-YYYY-MM-DD
---
#domaine/valeur1 #thème/thème1 #thème/thème2 #enjeu/enjeu1 #enjeu/enjeu2

![TITRE DE LA VIDÉO](https://www.youtube.com/watch?v=YOUTUBE_ID)

# TITRE DE LA VIDÉO

## Résumé
2-4 phrases décrivant le contenu et la thèse principale.

## Thèses et analyses clés
Liste numérotée des mécanismes/analyses principaux.
Chaque thèse avec un lien vers le concept correspondant via [[wikilink]].
Sourcer les points clés avec des notes de bas de page timestampées[^1].

## Résultats / projections
Si la vidéo contient des chiffres, sondages ou projections :
tableau markdown.

## Individus mentionnés
[[Nom1]], [[Nom2]], [[Nom3]]...

## Organisations mentionnées
[[Org1]], [[Org2]]...

## Concepts mobilisés
[[Concept1]], [[Concept2]]...

## Enjeux avancés
[[Enjeu1]] — comment cette vidéo fait avancer ce combat
[[Enjeu2]] — ...

## Transcript
[[Nom exact du fichier transcript sans .md]]

[^1]: [MM:SS](https://www.youtube.com/watch?v=YOUTUBE_ID&t=SECONDS) — "citation ou résumé du passage"
```

#### Principes de rédaction

- **Embed YouTube** : placer l'embed Obsidian juste après les hashtags, avant le `# Titre`, sous la forme `![titre](https://www.youtube.com/watch?v=ID)`. Obsidian reconnaît cette syntaxe image pointant vers une URL YouTube et affiche un lecteur embarqué. Ne **pas** utiliser de thumbnail cliquable via `img.youtube.com` — cette forme donne une image statique sans lecteur. Le `youtube_id` vient du frontmatter de la fiche vidéo ou du transcript source (tous deux portent ce champ). Si l'ID n'est pas disponible, omettre l'embed (ne pas inventer d'ID).
- **Le résumé** doit tenir en 2-4 phrases. Un lecteur qui ne lit que le résumé doit comprendre la thèse centrale.
- **Les thèses** sont numérotées et chacune contient au moins un [[wikilink]] vers un concept ou un enjeu. C'est ce qui fait de la fiche vidéo un nœud du graphe, pas un résumé isolé.
- **Notes de bas de page timestampées** : sourcer les points clés (citations marquantes, formulations de thèse, moments de débat) avec des footnotes qui pointent vers le timestamp YouTube exact. Format : `[^N]: [MM:SS](https://www.youtube.com/watch?v=ID&t=SECONDS) — "citation ou résumé"`. Convertir le timestamp en secondes pour le paramètre `&t=`. Ne footnote que ce qui est réellement dans le transcript — ne pas inventer de citations.
- **Résultats / projections** : ne pas inventer. Inclure uniquement les chiffres, sondages ou projections explicitement mentionnés dans le transcript.
- **Les listes d'entités** en bas servent de sommaire de liens — elles permettent la navigation dans le graphe.

### Étape 3 — Enrichissement (si fiche existante)

Si la fiche existe déjà (rare pour les vidéos, mais possible en cas de réingestion) :
- Compléter les sections manquantes
- Ajouter les thèses non couvertes
- Compléter les listes d'entités
- Ne pas supprimer de contenu existant
