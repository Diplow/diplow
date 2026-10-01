# Boniface — Contexte éditorial

## Objectif

Construire un graphe de connaissances documentant les analyses géopolitiques de Pascal Boniface — ses grilles de lecture, ses concepts, les personnes et organisations qu'il mobilise, les thèses qu'il défend de façon récurrente.

Le vault sert à :
1. **Restituer fidèlement** la vision géopolitique de Boniface, ses outils analytiques, ses positions stables.
2. **Répondre à des questions** sur la géopolitique selon l'angle Boniface quand on consulte le vault.

## Qui est Pascal Boniface

Pascal Boniface est un géopolitologue français, fondateur et directeur de l'**IRIS — Institut de Relations Internationales et Stratégiques**, think tank indépendant qu'il a créé en 1990. Il enseigne à l'Institut d'études européennes (Paris 8) et est l'auteur d'une cinquantaine d'ouvrages sur la géopolitique, les relations internationales, le conflit israélo-palestinien, le sport et la politique, l'Afrique.

Contrairement à un collectif militant, Boniface parle en son nom propre. Sa chaîne YouTube mêle :
- **Analyses courtes d'actualité** (5-15 min, réaction à un événement : sommet, élection, annonce diplomatique)
- **Émissions plus longues** (*Comprendre le monde*, interviews d'experts)
- **Promotion d'ouvrages** (lectures de chapitres, présentations de livres)

## Principes éditoriaux

**Posture : restitution fidèle.** On documente les analyses de Boniface comme étant celles du vault — on ne les nuance pas de l'extérieur, on ne les challenge pas. Quand Boniface affirme que « les États-Unis appliquent un deux-poids-deux-mesures entre l'Ukraine et Gaza », on écrit ça, pas « selon certains analystes... ».

**Nuance importante** : Boniface lui-même est un analyste qui nuance, contextualise, reconnaît les tensions. Restituer ses analyses inclut donc ses propres nuances — ne pas les durcir en slogans militants qu'il n'emploie pas.

**Attribution individuelle par défaut.** Contrairement à un collectif, Boniface parle en son nom. Les analyses sont attribuées à « Boniface » ou « Pascal Boniface ». Quand il interviewe un invité, bien distinguer la position de l'invité de celle de Boniface (ne pas attribuer à Boniface ce que dit son invité).

**Ton analytique, pas encyclopédique.** Restituer avec précision les grilles de lecture, les mécanismes, les exemples qu'il mobilise — pas un résumé Wikipedia des sujets abordés.

## Pièges de lecture

1. **Format court ≠ analyse légère.** Les vidéos de 5-10 min sont souvent des applications rapides de grilles analytiques qu'il développe ailleurs plus longuement. Ne pas créer une fiche Enjeu pour chaque vidéo — attendre la récurrence.

2. **Interviews et émissions longues** : bien distinguer ce que dit Boniface de ce que disent ses invités. Dans une fiche vidéo, l'invité peut avoir une section dédiée ; mais les *Concepts* et *Enjeux* de la fiche doivent être ceux que **Boniface** mobilise, pas ceux de l'invité (sauf si Boniface les reprend).

3. **Pas de clickbait au sens des chaînes militantes.** Les titres sont généralement sobres et informatifs. Par contre, attention aux vidéos de réaction à l'actualité qui peuvent surpondérer un événement passager — chercher la grille d'analyse sous-jacente plutôt que commenter l'événement lui-même.

4. **Sections promotionnelles.** Quand Boniface présente un de ses livres, il en fait parfois de longues lectures. Distinguer dans le transcript la partie analyse de la partie promotion — la fiche vidéo rend compte de l'analyse, pas de la promotion.

5. **Répétition des grilles.** Boniface mobilise les mêmes outils analytiques à travers des dizaines de vidéos. C'est normal et c'est précisément ce que le vault doit capturer dans `Enjeux/` (voir ci-dessous). Ne pas traiter les redites comme une pauvreté — c'est de la cohérence.

## Format « J'ai lu » — fiches Livres

Boniface publie régulièrement des vidéos de chronique d'ouvrage, typiquement sous le format **« J'ai lu X de Y »** : il restitue les thèses principales du livre et donne son appréciation (ce qu'il retient, ce qu'il apprécie, éventuellement ses réserves).

Pour ces vidéos, le pivot de l'ingestion n'est pas une fiche `Videos/` mais une fiche `Livres/` (voir la skill `write-book` au niveau WikiPol). La fiche Livre porte elle-même l'embed YouTube, le lien vers le transcript, et structure le contenu autour de l'ouvrage (auteur, titre, année, thèses, appréciation) plutôt qu'autour de la vidéo.

**Critère de détection** : la vidéo est majoritairement consacrée à un **ouvrage unique** identifié par titre + auteur, avec restitution des thèses et appréciation explicite de Boniface. Indices :
- Titre de la vidéo contenant « J'ai lu », « Lecture de », « Notes de lecture », « Chronique », « Le livre de », « À propos du livre de »
- Transcript structuré autour d'un livre (introduction du livre et de son auteur, présentation des thèses, conclusion avec verdict)

Cas limites :
- **Interview de l'auteur du livre** → décision selon le focus. Si l'échange tourne entièrement autour du livre, fiche Livre. Si l'auteur parle plus largement de son actualité/son travail, fiche Vidéo standard (avec wikilink vers la fiche Livre si elle existe déjà).
- **Vidéo évoquant plusieurs livres** → fiche Vidéo standard, avec wikilinks vers des fiches Livres existantes.
- **Promotion de son propre livre par Boniface** → fiche Vidéo (c'est de la présentation éditoriale, pas une chronique critique au sens « j'ai lu »).

**Les fiches Livres accumulent.** Si Boniface rechronique le même livre dans une seconde vidéo, enrichir la fiche existante — ne pas créer de doublon.

## Attribution

Par défaut : « Pascal Boniface » ou « Boniface ». Pas de « la source », pas de pseudo-collectif.

Pour les émissions avec invité : nommer l'invité quand une analyse lui est attribuable (« l'invité X soutient que... »). Ne reprendre l'analyse sous le nom de Boniface que s'il la reformule ou l'endosse explicitement.

## Enjeux — grilles analytiques récurrentes

**Définition locale** : contrairement à un vault militant où un *Enjeu* est un combat prescriptif, ici un *Enjeu* désigne une **grille de lecture structurante** que Boniface mobilise de façon récurrente pour analyser la géopolitique. Un enjeu est une façon de voir, pas une position à défendre.

Critère pour créer une fiche Enjeu :
- La grille revient dans **3+ vidéos** avec une formulation stable
- Elle structure l'analyse de plusieurs sujets (pas juste un cas isolé)
- On peut la résumer en une thèse en une ou deux phrases

Exemples candidats à valider par induction après plusieurs ingestions : *deux-poids-deux-mesures occidental*, *multilatéralisme vs unilatéralisme*, *fin de l'occidentalo-centrisme / émergence du Sud global*, *critique du néoconservatisme*, *biais médiatiques sur le Moyen-Orient*. Ne pas créer ces fiches avant d'avoir les 3+ vidéos qui justifient la récurrence.

## Distinction Concepts / Enjeux

- **Concept** = outil analytique avec mécanisme (ex: *soft power*, *puissance normative*, *équilibre des puissances*). Se définit en quelques phrases.
- **Enjeu** = grille de lecture structurante mobilisant plusieurs concepts (ex: *deux-poids-deux-mesures occidental*). C'est une thèse récurrente qui s'applique à plusieurs situations.

Dans le doute : terme définissable court → Concept. Thèse mobilisant plusieurs concepts → Enjeu.

## Usage du vault

Ce vault sert deux fonctions :

1. **Construction** — ingérer des vidéos de la chaîne *Pascal Boniface* via les skills WikiPol (voir `../../CLAUDE.md` et `../../BUILD.md`)
2. **Consultation** — répondre à des questions de géopolitique en restituant l'analyse de Boniface

Quand l'utilisateur pose une question géopolitique, chercher d'abord dans `Individus/`, `Organisations/`, `Concepts/`, `Videos/`, `Enjeux/`. Restituer l'analyse de Boniface, pas une synthèse généraliste.

## Principe d'auto-amélioration

Ce fichier est amené à évoluer. Si une ingestion révèle un pattern (une nouvelle grille récurrente, un piège de lecture non identifié, une nuance dans la posture éditoriale), raffiner ce `CLAUDE.md` plutôt que laisser la dérive se faire.
