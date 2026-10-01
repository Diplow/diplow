---
name: write-book
description: >
  Rédige ou enrichit une fiche Livres/ quand un contenu de la source est une présentation/chronique
  d'ouvrage (ex: format « J'ai lu » où l'auteur restitue et apprécie un livre). Remplace la fiche Vidéo
  standard pour ces cas — la fiche Livre contient elle-même l'embed YouTube et le lien vers le transcript.
  Appelée par ingest-video ou ingest-batch quand le transcript est identifié comme chronique livre.
date created: 2026-04-20
date modified: 2026-04-20
skill_version: write-book-2026-04-20
---

# Skill : Write Book

## Vue d'ensemble

Cette skill rédige ou enrichit une fiche dans `Livres/`. Elle existe pour un format spécifique : une vidéo dans laquelle la source **présente et apprécie un ouvrage** (typiquement « J'ai lu X de Y » chez Boniface, ou équivalent). Dans ce cas, la fiche Livre est la **fiche-pivot** de l'ingestion, à la place de la fiche Vidéo — elle porte l'embed YouTube, le lien vers le transcript, et l'analyse.

## Quand utiliser write-book plutôt que write-video

Une fiche Livre est appropriée quand :
- La vidéo est majoritairement consacrée à un **ouvrage unique**
- La source **restitue les thèses du livre** et **donne son appréciation**
- La fiche gagne en valeur si elle est indexée par le livre (auteur, titre) plutôt que par la vidéo

Cas limites :
- Si la vidéo évoque plusieurs livres sans en approfondir un seul → fiche Vidéo (éventuellement avec wikilinks vers des fiches Livres existantes)
- Si la source cite brièvement un livre dans une analyse plus large → fiche Vidéo, pas Livre
- Si la vidéo est un entretien avec l'auteur d'un livre → décision au cas par cas selon le focus : si la discussion tourne autour du livre, fiche Livre ; si l'auteur parle de son actualité plus largement, fiche Vidéo

## Prérequis

- Le transcript a été lu et analysé (thèses du livre, appréciation de la source, métadonnées)
- `Sources/.context-tmp.md` existe et a été produit par un appel **récent** à `gather-context` (sur l'auteur du livre, le sujet, ou des concepts associés). Si ce fichier n'existe pas, interrompre et demander à l'appelant de lancer `gather-context` d'abord.

**Conventions partagées** : voir `BUILD.md` de WikiPol.
**Ton et principes éditoriaux** : voir `CLAUDE.md` de la source.

---

## Entrée

- **Transcript analysé** : titre vidéo, date, youtube_id, auteur et titre du livre, thèses, appréciation
- **Contexte vault** : `Sources/.context-tmp.md`

## Sortie

Une fiche `Livres/Titre du Livre.md` créée ou enrichie.

Nom de fichier : le **titre du livre** (pas le titre de la vidéo), normalisé selon les conventions de WikiPol (sans accents, sans caractères spéciaux). Si plusieurs ouvrages partagent un titre générique, préciser avec l'auteur : `Titre — Auteur.md`.

---

## Workflow

### Étape 1 — Vérifier si la fiche existe

Chercher dans `Livres/` un fichier correspondant au titre du livre. Si la fiche existe (la source a pu chroniquer le même livre à plusieurs reprises, ou une autre source du vault en parle déjà), la lire — c'est un enrichissement.

Vérifier aussi dans `Individus/` si l'auteur du livre a une fiche. Sinon, en créer une (même ébauche) via `write-entity`.

### Étape 2 — Rédiger la fiche

#### Template

```markdown
---
type: livre
domaine: [valeur1]
thèmes: [thème1, thème2]
enjeux: [enjeu1]
livre_auteur: "Prénom Nom"
livre_titre: "Titre exact de l'ouvrage"
livre_annee: YYYY
livre_editeur: "Éditeur"
date_video: YYYY-MM-DD
youtube_id: "XXXXXXXXXXX"
aliases: [titre alternatif]
skill_version: write-book-YYYY-MM-DD
---
#domaine/valeur1 #thème/thème1 #thème/thème2 #enjeu/enjeu1

![TITRE DE LA VIDÉO](https://www.youtube.com/watch?v=YOUTUBE_ID)

# Titre du livre — [[Prénom Nom]]

## Présentation
Contexte de l'ouvrage tel que la source le pose : sujet, cadrage, enjeu central.
2-5 phrases.

## Thèses de l'ouvrage
Les thèses principales que le livre défend, telles que la source les rapporte.
Liste numérotée. Chaque thèse sourcée par une note de bas de page timestampée[^1].
Distinguer clairement les thèses du livre (ce que l'auteur dit) des interventions
de la source (ce qu'elle en pense — section suivante).

## Appréciation de la source
Ce que la source retient, apprécie, critique. Les points forts et les limites
selon elle. Utile pour comprendre pourquoi elle recommande (ou non) l'ouvrage.

## Concepts mobilisés
[[Concept1]], [[Concept2]]... — concepts que le livre (ou la source à travers lui) mobilise.

## Individus mentionnés
[[Auteur du livre]], [[autre personne citée]]...

## Organisations mentionnées
[[Org1]], [[Org2]]...

## Enjeux éclairés
[[Enjeu1]] — en quoi ce livre enrichit cette grille
[[Enjeu2]] — ...

## Transcript
[[Nom exact du fichier transcript sans .md]]

[^1]: [MM:SS](https://www.youtube.com/watch?v=YOUTUBE_ID&t=SECONDS) — "citation ou résumé du passage"
```

#### Principes de rédaction

- **Indexation par le livre, pas par la vidéo.** Le titre H1 est le titre du livre + auteur wikilinké. C'est la différence centrale avec une fiche Vidéo.
- **Distinguer livre et source.** Ne pas mélanger « le livre affirme que X » et « la source pense que X ». Utiliser la section *Thèses de l'ouvrage* pour le premier, *Appréciation* pour le second.
- **Embed YouTube** : même règle que pour write-video — juste après les hashtags, avant le titre.
- **Auteur wikilinké dès le titre H1.** Si la fiche Individu de l'auteur n'existe pas, la créer (même ébauche) — ne pas laisser un lien orphelin sur le titre.
- **Footnotes timestampées** : sourcer les thèses clés et les jugements forts de la source.

### Étape 3 — Fiche Individu de l'auteur

Si l'auteur du livre n'a pas de fiche dans `Individus/`, la créer via `write-entity` (au moins une ébauche). Ajouter dans sa fiche une section *Ouvrages chroniqués* ou l'équivalent, pointant vers la fiche Livre.

Seuil : même règle WikiPol. Un auteur dont un seul livre est chroniqué mérite quand même une fiche Individu (c'est un passage clé — la chronique lui est intégralement consacrée).

### Étape 4 — Enrichissement (si fiche existante)

Si la fiche Livre existe déjà (la source a rechroniquer, ou une autre vidéo revient dessus) :

1. **Ne pas supprimer** de contenu existant
2. **Intégrer** les nouvelles thèses ou appréciations dans les sections pertinentes
3. **Ajouter** la nouvelle vidéo dans une sous-section *Autres chroniques* (avec embed et footnotes distinctes si pertinent)
4. **Mettre à jour** l'appréciation si elle a évolué

---

## Articulation avec l'Inventaire

La vue `Sources/Inventaire.md` apparie transcripts et fiches via `youtube_id`. Pour que l'appariement fonctionne avec une fiche Livre :
- La fiche Livre doit porter `youtube_id` dans le frontmatter (prévu par le template)
- La vue DataviewJS de l'Inventaire doit scanner `Livres/` en plus de `Videos/` (voir la requête Dataview de la source si elle a été personnalisée pour PaduTeam — pour une nouvelle source, la requête par défaut scanne le vault entier)

Pas d'action manuelle requise sur l'Inventaire.
