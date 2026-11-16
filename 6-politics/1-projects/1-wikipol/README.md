# WikiPol

Ossature générique pour construire des graphes de connaissances Obsidian à partir de sources média (chaînes YouTube aujourd'hui, éventuellement articles/podcasts à terme).

Chaque *Source* est un nœud de `6-politics/2-sources/` (`<n>-<slug>/`) : sa config `source.yaml`, son contexte éditorial `CLAUDE.md`, et sa Chronicle `1-chronicle/`, où le pipeline range un Digest par Publication. L'ossature (skills Claude, scripts Python, conventions) vit ici, dans WikiPol.

Les vaults Obsidian d'avant (PaduTeam, Boniface) sont figés dans `Legacy/` depuis WIK-1 : lus en entrée, jamais écrits.

## Quickstart

Dans une session Claude Code ouverte sur le dépôt :

```
/politics:wikipol:new-source https://www.youtube.com/@MaChaine     # le nœud, sa config, son contexte éditorial
/politics:wikipol:ingest-source machaine                          # ses Raws, ses Digests, sa Chronicle
```

La première crée `6-politics/2-sources/<n>-machaine/` et rédige son contexte éditorial ; la seconde récupère les sous-titres de la chaîne, écrit un Digest par vidéo et les range par date. Relancée plus tard, elle n'apporte que les vidéos publiées depuis. Les commandes qu'elles enchaînent (`wikipol fetch`, `digest`, `file`, `index`) sont décrites dans `CLAUDE.md`.

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
