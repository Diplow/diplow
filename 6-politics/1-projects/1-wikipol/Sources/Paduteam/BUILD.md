---
date created: Sunday, April 12th 2026, 6:30:00 pm
date modified: Monday, April 20th 2026, 1:28:00 pm
---
# BUILD.md — Comment le vault Paduteam est construit

Ce fichier documente la **taxonomie locale** de Paduteam et les **spécifications des couches advanced** (Enjeu, Conjoncture, Possible, Methode). Les conventions universelles (nommage, wikilinks, frontmatter de base, workflow git) vivent dans `BUILD.md` à la racine de WikiPol — ne pas les redoublonner ici.

Les skills individuelles (dans `Skills/`) décrivent leur workflow spécifique ; ce fichier contient les invariants propres à Paduteam.

---

## Architecture des skills

```
┌──────────────────────────────────────────────────────┐
│  ingest-batch (optionnel)                            │
│  Regroupe N transcripts par sujet, construit une     │
│  synthèse cross-vidéos, puis dispatche vers les       │
│  skills write-* avec ce contexte consolidé.          │
│  Un seul commit / PR pour tout le batch.             │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  ingest-video (orchestrateur principal)               │
│  1. Lit le transcript                                │
│  2. Appelle gather-context pour le sujet             │
│  3. Dispatche vers les skills spécialisées           │
│  4. Commit direct sur develop                        │
└───────┬──────────┬──────���───┬──────────┬─────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
   write-video  write-entity  write-concept  write-enjeu
   (fiche vidéo) (individu   (fiche concept) (fiche enjeu)
                  ou orga)
```

### Principe central : séparer contexte et écriture

Chaque skill spécialisée (`write-*`) reçoit en entrée :
- Le **contexte** rassemblé par `gather-context` (fiches vault existantes, vidéos liées, entités connexes)
- Les **fiches existantes** pertinentes (déjà lues)
- Les **instructions d'écriture** spécifiques à son type

Elle ne fait **pas** de recherche extensive. Elle prend le contexte pour acquis et se concentre sur la rédaction.

### Skills

Skills génériques héritées de WikiPol (non listées ici, voir `BUILD.md` racine) : `gather-context`, `ingest-video`, `ingest-batch`, `write-video`, `write-entity`, `write-concept`, `write-evenement`, `synthesize-couche`.

Skills source-spécifiques de Paduteam (dans `Sources/Paduteam/Skills/`) :

| Skill | Rôle |
|-------|------|
| `write-enjeu` | Rédiger/enrichir une fiche `Enjeux/` (format loadout militant). Rédaction pure — l'orchestration est gérée par `synthesize-couche` (WikiPol). |
| `write-conjoncture` | Rédiger/enrichir une fiche `Conjonctures/` (`type: conjoncture`). Rédaction pure. |
| `write-possible` | Rédiger/enrichir une fiche `Possibles/` (`type: possible`). Rédaction pure. |
| `write-methode` | Rédiger/enrichir une fiche `Methodes/` (`type: methode`). Rédaction pure. |

Les skills `write-<couche>` ne gèrent ni git, ni gather-context, ni la lecture des vidéos — c'est l'orchestrateur générique `synthesize-couche` qui s'en charge avant de leur déléguer la rédaction.

### Couches advanced de Paduteam

Au-delà des 5 types de fiches « entité » (Vidéos / Individus / Organisations / Concepts / Evenements), 4 **couches advanced** structurent la pensée PaduTeam comme projet :

- **Enjeux** (`Enjeux/`) — combats stratégiques récurrents (3+ vidéos avec position constante).
- **Conjonctures** (`Conjonctures/`) — diagnostics du moment historique (crise de l'hégémonie US, triple crise du capitalisme, etc.).
- **Possibles** (`Possibles/`) — horizons défendus (universalisme matériel, choc d'abondance, etc.). Un possible se déploie *vers* un horizon ; un enjeu se mène *contre* un adversaire.
- **Methodes** (`Methodes/`) — procédures analytiques réutilisables (matérialisme historique, Le Graphique, analyse en blocs sociaux). Une méthode organise le *regard*, pas une thèse politique.

**Approche actuelle (vraies fiches).** Chaque couche est matérialisée par de **vraies fiches dans son dossier dédié** avec `type: enjeu | conjoncture | possible | methode`. Les fiches sont produites par les skills `write-<couche>` (locales à Paduteam) via le workflow `synthesize` de WikiPol (`Scripts/synthesize.py`).

**Cohabitation avec le legacy `couche:`.** Une douzaine de Concepts existants portent encore un champ `couche: conjoncture | possible | methode` en frontmatter — vestiges de l'approche initiale où les couches étaient des *vues virtuelles* sur Concepts. Ces fiches restent en l'état : pas de migration. Les `.base` des dossiers Conjonctures/Possibles/Methodes acceptent les deux conventions (`type == "<couche>" OR couche.contains("<couche>")`). Pour les nouvelles synthèses, **toujours créer une vraie fiche dans le dossier dédié** — ne plus utiliser `couche:` sur des Concepts.

### Spécifications des couches

#### Enjeu

- **Critère de création** : combat stratégique récurrent (3+ vidéos avec position constante).
- **Format** : « loadout militant » — outil de retrieval pour activistes, pas essai analytique.
  - Thèse (15-25 mots, mobilisable telle quelle)
  - Dispositifs adverses à désamorcer (sous-sections par cadrage adverse)
  - Arguments de fond (bullets, pas paragraphes)
  - Munitions factuelles (dates, chiffres, cas — **gras pour les clés**)
  - Adversaires (regroupés par type)
  - Alliés (optionnel)
  - Concepts-outils (regroupés par fonction)
  - Cas d'application (optionnel — déclinaison par région/secteur)
  - Vidéos par usage (catégorisées par fonction militante, pas chronologie)
  - Log d'évolution
- **Frontmatter** :
  ```yaml
  type: enjeu
  domaine: [...]
  thèmes: [...]
  skill_version: write-enjeu-...
  aliases: [...]            # optionnel
  ```
- **Nom de fichier** : nom court du combat, sans accents (`Plus jamais PS.md`, `Palestine libre.md`).

#### Conjoncture

- **Critère de création** : diagnostic du moment historique posé explicitement (2+ vidéos avec diagnostic stable, formulation claire — pas une déduction).
- **Format** :
  - Diagnostic (1-3 phrases : qu'est-ce qui est structurant ?)
  - Mécanisme causal (rapport causal — pas description, explication)
  - Symptômes / manifestations (liste des phénomènes visibles)
  - Période (bornes temporelles approximatives)
  - Concepts associés (wikilinks)
  - Vidéos clés
- **Frontmatter** :
  ```yaml
  type: conjoncture
  domaine: [...]
  thèmes: [...]
  statut: ouverte           # ouverte | confirmée | infirmée | dépassée
  periode: "2008-2026"
  skill_version: write-conjoncture-...
  aliases: [...]            # optionnel
  horizon: 2030-12-31       # optionnel
  ```
- **Nom de fichier** : nom court du diagnostic, sans accents (`Crise de l hegemonie americaine.md`).

#### Possible

- **Critère de création** : trajectoire alternative explicitement articulée par la source (pas une déduction de l'analyste).
- **Format** :
  - Horizon (vision positive du monde défendue)
  - Mécanisme matériel (comment on y va — pas juste « c'est bien »)
  - Vision adverse (le possible concurrent)
  - Concepts associés (wikilinks)
  - Vidéos clés
- **Frontmatter** :
  ```yaml
  type: possible
  domaine: [...]
  thèmes: [...]
  nature: programmatique    # programmatique | contrefactuel
  skill_version: write-possible-...
  aliases: [...]            # optionnel
  acteurs_pivots: [...]     # optionnel
  horizon: 2030-12-31       # optionnel
  ```
- **Nom de fichier** : nom de la trajectoire, sans accents (`Universalisme materiel.md`).

#### Methode

- **Critère de création** : procédure analytique réutilisable enseignée ou systématiquement appliquée par PaduTeam — décomposable en étapes, pas une simple grille de lecture.
- **Format** :
  - Définition (1-3 phrases : principe d'analyse ?)
  - Mécanisme (étapes ordonnées : quelles distinctions elle produit, quels rapports elle met en lumière)
  - Exemples d'application (2-4 cas concrets)
  - Concepts dérivés (wikilinks)
  - Adversaires méthodologiques (méthodes alternatives critiquées)
  - Vidéos où elle est mobilisée
- **Frontmatter** :
  ```yaml
  type: methode
  domaine: [...]
  thèmes: [...]
  etapes:
    - "Étape 1 courte"
    - "Étape 2 courte"
  skill_version: write-methode-...
  aliases: [...]            # optionnel
  ```
- **Nom de fichier** : nom court de la méthode, sans accents (`Materialisme historique.md`, `Graphique.md`).

---

## Invariants — Règles communes à toutes les skills

### Attribution

**Attribution collective par défaut.** Les analyses sont attribuées à "la PaduTeam", pas à un membre individuel. N'attribuer individuellement que quand c'est explicitement identifiable dans le transcript :
- Segment solo (un seul intervenant)
- Auto-identification ("moi en tant que médecin...")
- Rôle spécifique reconnu ("Chris qui a conçu le Graphique")

### Noms de fichiers

- Pas d'accents ni de caractères spéciaux dans les noms de fichiers
- Les noms accentués sont définis en `aliases` dans le frontmatter
- **Individus** : Prénom Nom (`Jean-Luc Melenchon.md`)
- **Organisations** : Nom officiel complet (`France Insoumise.md`, pas `LFI.md`)
- **Concepts** : Nom descriptif capitalisé (`Eclatement du bloc central.md`)
- **Enjeux** : Nom court du combat (`Plus jamais PS.md`)
- **Vidéos** : Titre abrégé lisible (`COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR.md`)

### Wikilinks

- `[[Nom Exact du Fichier]]` sans chemin, sans `.md`
- Pour les alias : `[[Nom réel|alias affiché]]` (ex: `[[Parti Communiste Français|PCF]]`)
- Le nom du fichier = le texte du wikilink
- Chaque wikilink doit pointer vers un fichier existant. Si un lien orphelin est créé, créer au minimum une fiche ébauche.

### YAML frontmatter

Pour les invariants communs (`type`, `domaine`, `thèmes`, `skill_version`), voir `BUILD.md` à la racine de WikiPol.

**Domaines Paduteam** : `politique-intérieure`, `géopolitique`, `économie`, `théorie`, `société` (1-2 valeurs par fiche).

**Champs spécifiques par type** :
- **Vidéos** : `enjeux:` (liste de wikilinks vers fiches `Enjeux/`), `date`, `youtube_id`. Optionnellement `methodes:`, `conjonctures:`, `possibles:` pour les vidéos qui mobilisent ces couches structurellement.
- **Individus / Organisations** : `aliases` recommandé.
- **Concepts** : `aliases` recommandé. *Legacy* : `couche` (`methode | conjoncture | possible`, peut être une liste si transverse) + `periode` — ne plus appliquer aux nouvelles fiches, voir « Cohabitation » ci-dessus.
- **Enjeux / Conjonctures / Possibles / Methodes** : voir la section « Spécifications des couches » ci-dessus.
- **Evenements** : `date_debut` (YYYY-MM-DD), optionnels `date_fin`, `lieu`, `acteurs` (liste de wikilinks), `aliases`.

### Back-références vers les couches

Les fiches Vidéos déclarent en frontmatter quelles couches elles mobilisent (champs `enjeux:`, `methodes:`, `conjonctures:`, `possibles:` au pluriel — listes de noms de fiches sans accents). Cela permet aux skills `synthesize-couche` et `gather-context` de retrouver les vidéos par grep sur frontmatter.

Ne pas remplir ces champs gratuitement — uniquement si la vidéo *traite significativement* de la couche.


### Hashtags inline

Après le frontmatter YAML, les fiches incluent une ligne de hashtags structurés avant le titre `# Titre` :

```
#domaine/valeur #thème/valeur #enjeu/valeur
```

Inclure uniquement domaine, thèmes et enjeux (pas format ni statut). Ces hashtags matérialisent les tags comme nœuds du graphe Obsidian.

### Taxonomie des tags

3 axes structurent le tagging :

1. **domaine** — champ d'analyse (politique-intérieure, géopolitique, économie, théorie, société)
2. **thèmes** — sujets spécifiques récurrents. Vocabulaire contrôlé, extensible : `élections`, `anti-impérialisme`, `Palestine`, `Venezuela`, `féminisme`, `racisme-antiracisme`, `ruralité`, `médias-propagande`, `guerre-des-gauches`, `le-Graphique`, `travail`, `écologie`, `répression-justice`, `psychiatrie-psychologie`, `Iran`, `États-Unis`, `Amérique-latine`, `antivalidisme`, `santé`. Ajouter un nouveau thème si un sujet revient dans 2+ vidéos.
3. **enjeux** — combats stratégiques récurrents : `plus-jamais-PS`, `Palestine-libre`, `anti-impérialisme`, `le-Graphique`, `union-populaire`, `campisme-assumé`. Ajouter un nouvel enjeu si un combat revient dans 3+ vidéos avec une position constante.

**Le tag `paduteam` n'est pas utilisé** — tout le vault est PaduTeam par définition.

### Sourcing YouTube

Les fiches vidéo incluent un lien YouTube embarqué en haut (avant le résumé) et des notes de bas de page avec timestamps pour sourcer les points clés.

**Lien embarqué** (en haut de chaque fiche vidéo, après les hashtags, avant le `# Titre`) :
```markdown
![TITRE](https://www.youtube.com/watch?v=YOUTUBE_ID)
```

**Notes de bas de page avec timestamp** (dans le corps des fiches — vidéos, entités, concepts, enjeux) :
```markdown
La PaduTeam affirme que le PS est structurellement incapable de rupture[^1].

[^1]: [12:34](https://www.youtube.com/watch?v=YOUTUBE_ID&t=754) — "citation exacte ou résumé du passage"
```

Le `youtube_id` est stocké dans le frontmatter de la fiche vidéo. Pour convertir un timestamp `MM:SS` en secondes pour le paramètre `&t=`, utiliser le helper `Scripts/timestamp_to_seconds.py` à la racine WikiPol.

Pour les fiches non-vidéo (entités, concepts, enjeux), les footnotes référencent la vidéo source via son youtube_id — récupéré depuis la fiche vidéo correspondante.

### Style

- Phrases courtes, pas de remplissage
- Fidélité totale à l'analyse PaduTeam
- Ton analytique, pas encyclopédique — restituer la vision de la PaduTeam, pas Wikipedia
- Les jugements de valeur de la PaduTeam font partie de la restitution : ne pas les censurer, ne pas les atténuer
- Si la PaduTeam dit "Hollande est un traître", écrire "Hollande est un traître"

### Volume

Être ambitieux dans la création de fiches. Chaque personne mentionnée significativement, chaque parti cité, chaque mécanisme analytique décrit mérite sa fiche. Il vaut mieux créer une fiche minimale (ébauche) que de laisser un lien orphelin.

---

## Workflow git

Le vault est versionné sur GitHub (`Diplow/paduteam-wiki`). Voir aussi le workflow git défini dans `BUILD.md` à la racine de WikiPol — Paduteam n'a pas de spécificité.

### Branches

```
main              ← production (publication du wiki)
 └── develop      ← intégration et travail courant
```

- **`main`** : état publié du wiki. Jamais de push direct — promu depuis `develop` par l'utilisateur.
- **`develop`** : branche unique de travail. Les ingestions, synthèses et corrections committent **directement** sur `develop`. Pas de branches éphémères.

### En début d'ingestion ou de synthèse

1. Se placer sur develop à jour : `git checkout develop && git pull origin develop`

### En fin d'ingestion ou de synthèse

1. Stage les fichiers modifiés/créés par nom (pas `git add -A`)
2. Commit avec message structuré sur `develop` :
   ```
   ingest: TITRE ABRÉGÉ DE LA VIDÉO

   Fiches créées: X (liste)
   Fiches enrichies: Y (liste)
   Corrections ortho: Z (liste si applicable)

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
   Préfixes : `ingest:` (1 vidéo), `ingest-batch:` (batch), `synthesize: COUCHE — Nom cible` (synthèse).
3. Push direct : `git push origin develop`

### Publication (develop → main)

Merge manuel par l'utilisateur. Publication via Obsidian Publish.

---

## Chemins du vault

```
Sources/Paduteam/
├── Bienvenue.md                     ← homepage publique (Obsidian Publish)
├── CLAUDE.md                        ← instructions projet (ce qu'est le vault)
├── BUILD.md                         ← ce fichier (taxonomie + spécifications des couches)
├── source.yaml                      ← config paramétrique (content_types, git, model)
├── Sources/
│   ├── Inventaire PaduTeam.md       ← table des vidéos
│   └── Transcripts/                 ← transcripts bruts (.md)
├── Syntheses/                       ← batch files pour `Scripts/synthesize.py`
├── Videos/                          ← 1 fiche par vidéo ingérée
├── Individus/                       ← 1 fiche par personne
├── Organisations/                   ← 1 fiche par parti/asso/média
├── Concepts/                        ← 1 fiche par concept analytique
├── Enjeux/                          ← couche advanced — fiches loadout (type: enjeu)
├── Conjonctures/                    ← couche advanced — type: conjoncture (+ legacy: concepts couche=conjoncture)
├── Possibles/                       ← couche advanced — type: possible (+ legacy: concepts couche=possible)
├── Methodes/                        ← couche advanced — type: methode (+ legacy: concepts couche=methode)
├── Evenements/                      ← 1 fiche par fait daté, organisé par période
│   ├── 2026/
│   ├── 1950-1979/
│   └── ...
└── Skills/                          ← skills Claude (1 dossier par skill, dont write-<couche>)
```

**Chemin (submodule depuis la racine WikiPol) :** `Sources/Paduteam/` (où WikiPol est le repo parent — `../../` depuis ce fichier).
**Repo GitHub :** `git@github.com:Diplow/paduteam-wiki.git`
