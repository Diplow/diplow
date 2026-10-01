# WikiPol

Ossature générique pour construire des graphes de connaissances Obsidian à partir de sources média (chaînes YouTube aujourd'hui, éventuellement articles/podcasts à terme).

Chaque *source* vit dans `Sources/<NomSource>/` comme un vault Obsidian autonome. L'ossature (skills Claude, scripts Python, conventions) est partagée au niveau du repo.

## Quickstart

```bash
# 1. Créer une nouvelle source
python Scripts/new_source.py --name "MaChaine" --slug "machaine" \
    --youtube-url "https://www.youtube.com/@MaChaine/videos"

# 2. Remplir le contexte éditorial (ton, pièges de lecture, principes)
$EDITOR Sources/MaChaine/CLAUDE.md

# 3. Découvrir les vidéos et peupler l'inventaire
python Scripts/batch_transcripts.py --source Sources/MaChaine --discover

# 4. Extraire les transcripts
python Scripts/batch_transcripts.py --source Sources/MaChaine --extract

# 5. Générer le fichier de suivi chronologique
python Scripts/generate_chronological.py --source Sources/MaChaine

# 6. Lancer l'ingestion du premier batch
python Scripts/run_ingest.py --source Sources/MaChaine --batch 1
```

## Architecture

```
WikiPol/
├── CLAUDE.md            Instructions méta
├── BUILD.md             Conventions universelles
├── Skills/              7 skills Claude partagés
├── Scripts/             Scripts Python partagés
├── Templates/           Templates de bootstrap
└── Sources/
    └── <NomSource>/     Vault Obsidian autonome par source
        ├── source.yaml  Config paramétrique (unique point de vérité)
        ├── CLAUDE.md    Contexte éditorial de la source
        ├── BUILD.md     Taxonomie locale
        ├── Videos/ Individus/ Organisations/ Concepts/ Enjeux/
        └── Sources/Transcripts/
```

Voir `CLAUDE.md` pour les instructions de travail et `BUILD.md` pour les conventions.

## Exemple de source mature

Le projet [Graphiked](https://github.com/Diplow/paduteam-wiki) — vault PaduTeam — est l'incubateur historique de cette ossature. Il reste pour l'instant un repo séparé, migré plus tard si WikiPol fait ses preuves sur d'autres sources.
