# WikiPol

Ossature générique pour construire des graphes de connaissances Obsidian à partir de sources média (chaînes YouTube aujourd'hui, éventuellement articles/podcasts à terme).

Chaque *Source* est un nœud de `6-politics/2-sources/` (`<n>-<slug>/`) : sa config `source.yaml`, son contexte éditorial `CLAUDE.md`, et sa Chronicle `1-chronicle/`, où le pipeline range un Digest par Publication. L'ossature (skills Claude, scripts Python, conventions) vit ici, dans WikiPol.

Les vaults Obsidian d'avant (PaduTeam, Boniface) sont figés dans `Legacy/` depuis WIK-1 : lus en entrée, jamais écrits.

## Quickstart

```bash
# 1. Créer le nœud d'une nouvelle source (6-politics/2-sources/<n>-machaine/)
python Scripts/new_source.py --name "MaChaine" --slug "machaine" \
    --youtube-url "https://www.youtube.com/@MaChaine/videos"

# 2. Remplir le contexte éditorial (ton, pièges de lecture, principes)
$EDITOR ../../2-sources/<n>-machaine/CLAUDE.md
```

La suite (récupérer les Raws, écrire les Digests) est le pipeline du projet « Sources from YouTube », en construction.

## Architecture

```
6-politics/
├── 1-projects/1-wikipol/   WikiPol
│   ├── CLAUDE.md           Instructions méta
│   ├── CONTEXT.md          Le glossaire
│   ├── BUILD.md            Conventions universelles
│   ├── Skills/             Skills Claude partagés
│   ├── Scripts/            Scripts Python partagés
│   ├── Templates/          Templates de bootstrap
│   └── Legacy/             Les vaults d'avant, figés
│       └── <NomSource>/    Videos/ Individus/ Organisations/ Concepts/ Enjeux/ …
└── 2-sources/              Une Source par nœud, six au plus
    └── <n>-<slug>/
        ├── source.yaml     Config paramétrique (legacy.vault pointe vers son vault figé)
        ├── CLAUDE.md       Contexte éditorial de la source
        ├── 1-chronicle/    Les Digests, rangés par date en Periods
        └── .skills/        Skills propres à la source (optionnel)
```

Voir `CLAUDE.md` pour les instructions de travail et `BUILD.md` pour les conventions.

## Exemple de source mature

Graphiked, le vault PaduTeam (`Legacy/Paduteam/`), est l'incubateur historique de cette ossature. Ses deux sources, PaduTeam et Boniface, étaient des sous-modules git ; elles sont désormais copiées dans le dépôt `Diplow/diplow`, sous `6-politics/1-projects/1-wikipol/`, où vit WikiPol. Les anciens dépôts (`Diplow/wikipol`, `Diplow/paduteam-wiki`, `Diplow/boniface-wiki`) ne sont plus la source de vérité.
