---
date created: Friday, April 3rd 2026, 2:57:57 pm
date modified: Wednesday, April 15th 2026, 1:40:01 pm
---
# Graphiked — Base de connaissances PaduTeam


## C'est quoi ce site ?

Ce wiki est une base de connaissances interactive construite à partir des vidéos de la [PaduTeam](https://www.youtube.com/@PaduTeam), chaîne YouTube marxiste-communiste francophone animée par [[Padu]], [[Chris]] et [[Dr Zoe|Zoé]].

L'objectif : rendre leur corpus analytique **navigable et interconnecté** — trouver facilement ce qu'ils pensent d'une personnalité, d'un parti, d'un concept, d'un enjeu géopolitique.

Le code source du wiki et son outillage d'ingestion sont publics : [github.com/Diplow/paduteam-wiki](https://github.com/Diplow/paduteam-wiki).

---

## Avertissement important

Ce site est :

- **Non officiel** — ni produit ni approuvé par la PaduTeam
- **Un proof of concept** — une démonstration de ce que pourrait être un tel outil, pas une ressource aboutie (à ce jour, près de 500 vidéos ont été intégrées, mais le corpus reste partiel et la couverture est inégale)
- **Quasi entièrement généré par IA** — les fiches sont produites automatiquement à partir des transcripts de vidéos par un modèle de langage (Claude), sans relecture attentive systématique

Les contenus restituent les analyses de la PaduTeam telles qu'elles sont exprimées dans leurs vidéos. Des erreurs, approximations ou oublis sont possibles. En cas de doute, retournez toujours à la source : les vidéos elles-mêmes.

---

## Comment naviguer sur ce site

Ce site utilise **Obsidian Publish**, une plateforme de publication de bases de connaissances en réseau. Si vous n'êtes pas familier avec ce format, voici les fonctionnalités clés :

### Liens et aperçus
Chaque mot souligné est un lien vers une autre fiche. **Survolez un lien** pour voir un aperçu du contenu sans changer de page. **Cliquez** pour y accéder.

### Le graphe interactif
En haut à droite (ou via le menu), un **graphe local** montre les connexions entre la fiche que vous lisez et les fiches voisines. Chaque point est une note, chaque trait est un lien. C'est une carte visuelle du réseau de connaissances autour du sujet que vous consultez. Cliquer sur l'un des points ouvre la note.

### Le graphe global
Accessible depuis l'accueil, le **graphe global** affiche toutes les fiches et leurs connexions. Les nœuds les plus connectés sont les concepts ou personnalités les plus centraux dans l'analyse PaduTeam.

### La recherche
La barre de recherche (loupe en haut à gauche) permet de chercher par mot-clé dans tout le contenu du vault — titres, corps de texte, tags.

### Les tags
Les fiches sont taguées par domaine (`#domaine/politique-intérieure`, `#domaine/géopolitique`...) et par thème. Cliquer sur un tag liste toutes les fiches partageant ce tag.

---

## Structure de la base

La base s'organise en deux niveaux : des **entités** (le matériau de base, une fiche par objet du monde) et des **couches d'accès** (des fiches synthétiques qui rendent navigable la pensée PaduTeam comme projet structuré).

### Entités

Une fiche par objet du monde, rédigée à partir des vidéos qui l'évoquent.

| Dossier | Contenu | Exemple |
|---|---|---|
| `Videos/` | Une fiche par vidéo ingérée — résumé, thèses défendues, liens vers les concepts | [[COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR]] |
| `Individus/` | Profils de personnalités politiques — position sur le Graphique, trajectoire | [[Jean-Luc Melenchon]] |
| `Organisations/` | Partis, associations, médias — dynamique, figures clés, analyse PaduTeam | [[France Insoumise]] |
| `Concepts/` | Outils analytiques de la PaduTeam — Le Graphique, la Moïsation, la Fascisation... | [[Graphique]] |
| `Evenements/` | Faits datés analysés en profondeur — organisés par période | [[Guerre USA-Iran 2026]] |

### Couches d'accès

Au-delà des entités, 4 couches reflètent la façon dont la PaduTeam pense. Chaque couche est un **dossier de fiches synthétiques à part entière**, rédigées en croisant plusieurs vidéos sources, avec son propre MOC d'entrée :

| Couche | Question | Exemples |
|---|---|---|
| [[Methodes (MOC)\|Méthodes]] | Avec quels outils analyser ? | Matérialisme historique, [[Graphique]], analyse en blocs sociaux |
| [[Conjonctures (MOC)\|Conjonctures]] | Dans quel moment vit-on ? | Crise de l'hégémonie US, Triple crise du capitalisme, Moïsation |
| [[Possibles (MOC)\|Possibles]] | Vers quels horizons aller ? | Universalisme matériel, Choc d'abondance, Désagrégation de l'empire |
| [[Enjeux (MOC)\|Enjeux]] | Quels combats mener ? | [[Plus jamais PS]], anti-impérialisme, condenser le mouvement gazeux |

---

*Ce wiki est un projet personnel, expérimental, sans but commercial.*
