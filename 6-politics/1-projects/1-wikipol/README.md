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

# 4. Extraire les transcripts, puis les pousser sur Google Drive (ils ne vont pas dans git)
python Scripts/batch_transcripts.py --source Sources/MaChaine --extract
rclone copy Sources diplow:WikiPol/Sources --include '/*/Sources/Transcripts/*.md'

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
        └── Sources/Transcripts/   Hors git, sur Google Drive (voir CLAUDE.md)
```

Voir `CLAUDE.md` pour les instructions de travail et `BUILD.md` pour les conventions.

## Exemple de source mature

Graphiked, le vault PaduTeam (`Sources/Paduteam/`), est l'incubateur historique de cette ossature. Ses deux sources, PaduTeam et Boniface, étaient des sous-modules git ; elles sont désormais copiées dans le dépôt `Diplow/diplow`, sous `6-politics/1-projects/1-wikipol/`, où vit WikiPol. Les anciens dépôts (`Diplow/wikipol`, `Diplow/paduteam-wiki`, `Diplow/boniface-wiki`) ne sont plus la source de vérité.
