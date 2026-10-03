---
name: play
description: Lancer et jouer une partie de Riftbound sur tcg-arena.fr via Claude-in-Chrome (browser automation). TCG Arena est un simulateur MANUEL — Claude engage les runes, déplace les unités, résout la pile lui-même. Use when the user wants to start/play an online game, set up a match, load a deck into the simulator, or play through turns together. Triggers include "/games:riftbound:play", "on joue une partie ?", "on lance une partie sur tcg-arena", "charge mon deck dans le simulateur", "on continue la partie".
title: play
parent: .skills/3-games/1-riftbound/play
owner: diplo
preview: >-
  Joue une partie de Riftbound sur tcg-arena.fr via Claude-in-Chrome : setup, lecture de l'état par le DOM, contrat jouer() de scripts/rift_lib.js, et deux sous-agents de décision (stratège, tacticien) dans agents/.
---

# Skill: play

> Chemins relatifs à `3-games/1-riftbound/` (le dossier Riftbound du repo) ; lancer les scripts depuis ce dossier.

Piloter une partie Riftbound sur **tcg-arena.fr** via les outils `mcp__claude-in-chrome__*`. TCG Arena est un **simulateur manuel multi-TCG** : rien n'est automatisé côté moteur. Tout ce qu'un joueur physique ferait à la main (payer un coût, déplacer une unité, résoudre une carte), c'est à **toi** de le faire clic par clic.

## Cadrage (à lire avant toute partie)

- **Outils** : charger le navigateur en **un seul** `ToolSearch` (core set : `tabs_context_mcp`, `navigate`, `computer`, `read_page`, `tabs_create_mcp`, + `get_page_text`/`find` au besoin). Toujours `tabs_context_mcp` en premier.
- **Login = interdit pour Claude** (règle de sécurité : pas de saisie de credentials). C'est l'utilisateur qui se connecte.
- **Decks** : l'utilisateur crée le deck sur le compte TCG Arena. Le format d'import correspond aux `decks/{legend}/{variant}/list.txt` (générés au format plateforme : blocs `Legend:` / `Champion:` / `MainDeck:` / `Battlefields:` / `Runes:` / `Sideboard:`, runes nommées `Calm Rune` / `Chaos Rune`).
- **Communication en partie = via le CHAT de l'app**, pas via la réponse Claude. Textbox "Chat..." en bas à droite ; entrer le texte puis `Return`. La réponse Claude sert au raisonnement stratégique (qu'on documente), le chat sert à parler à l'adversaire.
- **Pas de dialogues navigateur** : ne jamais déclencher d'`alert/confirm/prompt` JS (ça gèle l'extension).

## Le départ : « la partie commence aux 3 battlefields »

On considère que **la partie démarre quand l'écran des 3 battlefields apparaît** (1 à choisir). Tout ce qui précède (login, sélection du deck, lobby) est du pré-jeu géré avec l'utilisateur.

### Séquence des modals de setup (ordre observé)

1. **Deck selection** — vérifier `Format`, `Starting player`, l'onglet `Your decks`, et le deck choisi dans `Choose Your Deck`. Confirmer le bon deck → **Continue**.
2. **Swap cards with your sideboard** — étape sideboard pré-partie. En game 1, **ne rien swapper** (jouer la liste telle quelle) → **Continue** (en haut à droite).
3. **Board card selection** — **choisir UN battlefield** parmi les 3 (clic sur la carte voulue ; les 2 autres reçoivent une croix rouge, et **Continue** s'active). Règle Riftbound : en Bo1 chaque joueur amène 3 battlefields mais **un seul entre en jeu** → 2 battlefields contestés au total. Choisir selon le plan du deck (cf. `rules/riftbound_general_rules.md` §battlefields). **Automatisable** via le contrat `chooseBattlefield(carte)` (voir plus bas) → sélection + **Continue**.
4. **Choose starting player** — si tiré au sort pour décider : pour un deck **tempo/proactif**, prendre l'initiative (« You »). Coût pour l'adversaire qui suit = compensation **+1 rune** (3 au lieu de 2) à son 1er tour seulement. → **Confirm**.
5. **Mulligan** — le bouton `Mulligan` (centre-bas) distribue/ouvre la main d'ouverture (4 cartes). On peut mulligan **jusqu'à 2** cartes (auto-redraw, set-aside au fond du deck). Garder une main avec un plan + interaction cheap plutôt que sur-mulligan. → **Keep hand and start** (ou sélectionner les cartes à remplacer d'abord).
6. **Auto-début du tour** : le simulateur déroule Awaken → Beginning → **Channel (2 runes)** → **Draw (1)**. Vérifier dans le log à droite (`played Calm Rune`, `played Chaos Rune`, `drew 1`). On arrive en phase **Action** avec 2 runes dispo et 5 cartes (premier joueur).

## Boucle de jeu fondamentale — JOUER UNE CARTE

⚠️ **Erreur classique à éviter** : jouer une carte sans avoir payé le coût. Dans ce simulateur, payer est **manuel**.

1. **Payer le coût = ENGAGER les runes.** Avant de jouer, cliquer **une fois sur chaque rune** nécessaire pour la passer **à l'horizontale** (exhaust). 1 clic = 1 rune engagée = 1 énergie. Coût générique = n'importe quelle rune ; **pips colorés** = runes du domaine correspondant (Calm/Chaos…). Vérifier que le nombre de runes horizontales = le coût avant de continuer.
2. **Jouer la carte** : hover sur la carte en main → bouton **Play** (ou drag vers le plateau). Elle apparaît **en GROS à droite de l'écran = la PILE (stack)**.
3. **Fenêtre de réponse** : une carte sur la pile n'est pas résolue. Demander **« ok? »** dans le chat → l'adversaire peut répondre avec une carte (Reaction). *(En tout début de partie, quand l'adversaire n'a pas encore d'énergie, on peut résoudre sans attendre — sinon, attendre « ok ».)*
4. **Résoudre** sur « ok » : poser la créature dans la **base**, ou résoudre le sort / l'effet.

## Astuce de découverte du plateau

Maintenir une carte **« grabbed »** depuis la main (clic maintenu, sans relâcher) → les **noms des zones** s'affichent sur le plateau. Utiliser ça pour cartographier une zone inconnue au lieu de deviner.

## Le contrat `jouer(carte, [runes])` — code dans `scripts/rift_lib.js`

Le « script » d'exécution est **du vrai code versionné** : **`scripts/rift_lib.js` du dossier de cette skill** (`.skills/3-games/1-riftbound/play/scripts/rift_lib.js`). C'est une bibliothèque page-contexte (`window.rift`) qu'on **injecte une fois par partie** via `javascript_tool`. Elle **lit + valide seulement** (renvoie des plans), elle n'agit jamais — l'action passe par de vrais clics.

API exposée (`window.rift`) :
- `loadCatalog(cat)` → charge le catalogue du deck (`card_ids.json` : `ids` nom→set-id + `hash_ids` hash full-art→set-id). À appeler **une fois après injection**. Permet d'identifier les cartes rendues en set-id **ou** en full-art (`game_data_live/<hash>`).
- `resolveName(name)` → set-id depuis un nom (normalise virgule/casse).
- `readState()` → `{hand, stack, battlefields, runes}` de mon côté, ids + coords scalées.
- `decidePlay(targetId, cost)` → planifie un coup. `cost` = liste de couleurs de runes à engager. Renvoie `{status:'proceed', runeClicks:[…], cardClick:{…}}` ou `{status:'error', reason}`. **N'agit pas.**
- `chooseBattlefield(name)` → sur le modal « Board card selection », localise le battlefield voulu + le bouton Continue. Renvoie `{status:'proceed', bfClick:{…}, continueClick:{…}}` ou `{status:'error', reason}`. **N'agit pas.**
- `findButton(label)` → coords scalées d'un bouton par son texte (ex. `Continue`, `Select randomly`).
- `mulligan(names)` → sur le modal Mulligan, localise les cartes (≤2) à remplacer. Renvoie `{status:'proceed', cardClicks:[{name,x,y}]}` ou `error`. **N'agit pas.**
- `mulliganButton()` → coords du bouton de confirmation `Mulligan (N)` (n'existe qu'une fois ≥1 carte marquée).
- `resolve(location)` → localise la carte du haut de la pile + la zone cible (`base` par défaut). Renvoie `{status:'proceed', dragFrom:{x,y}, dragTo:{x,y}}` ou `error`. **N'agit pas** : l'appelant fait un `left_click_drag`.
- `defocus()` → blur le chat/input pour que les **raccourcis clavier** atteignent le jeu (à appeler avant toute action `key`, sinon la touche part dans le chat).
- `sendChat(msg)` → poste un message (focus + native setter + Entrée). `true` si envoyé.
- `readLog(n)` → N dernières lignes du log (vérité de jeu).

### Le contrat `jouer(carte, [runes])`

C'est la procédure que le stratège exécute **quand il a décidé de jouer une carte** :

1. **Résoudre le nom → set-id** via la table du deck **`decks/<legend>/<variant>/card_ids.json`** (clé `ids`, ex. `"Tideturner": "OGN-199"`). Générée par `python scripts/build_card_ids.py [deck_dir]` depuis `sets/*/source.json` (normalise virgule→tiret d'épithète + casse ; les cartes hors couverture comme Flash=`OGS-011` sont dans `MANUAL_OVERRIDES` du script). Régénérer si la liste change.
2. **Injecter** `rift_lib.js` si `window.rift` est absent (paste du fichier dans `javascript_tool`).
3. **Décider** : `JSON.stringify(window.rift.decidePlay('OGN-199', ['calm','calm']))`.
4. **Si `status:'error'`** → **ABANDON** : rapporter `reason`, ne rien cliquer, ne pas poster « ok? ». (Le coût encode la couleur : pas de mana de la bonne couleur → on ne joue pas, on ne tape pas au hasard.)
5. **Si `status:'proceed'`** → **un seul `browser_batch`** : un `left_click` par `runeClicks`, puis `left_click` sur `cardClick`, puis un item `javascript_tool` qui appelle `window.rift.sendChat('ok?')`. Puis **dire « ok? » et attendre** la réponse de l'adversaire.

Découpage Read/Act respecté : `decidePlay` (lecture/validation) en JS ; engager runes + jouer carte en **vrais clics** ; chat en JS (pas un état de jeu).

### Le contrat `chooseBattlefield(carte)`

Au setup, sur le modal **Board card selection** :

1. Injecter `rift_lib.js` + `loadCatalog(card_ids.json)` si pas déjà fait.
2. `JSON.stringify(window.rift.chooseBattlefield("Targon's Peak"))` → plan `{bfClick, continueClick}` (ou `error` si la carte n'est pas à l'écran / nom inconnu).
3. **`browser_batch`** : `left_click` sur `bfClick`, puis `left_click` sur `continueClick`. Le setup avance (→ Choose starting player / Mulligan).

Le choix du battlefield reste une **décision stratège** (cf. `rules/` : Targon's Peak = ramp + mana ouvert pour reactions, etc.). `chooseBattlefield` ne fait que l'exécuter mécaniquement. La résolution identifie la carte qu'elle soit rendue en **set-id** (Targon's Peak) ou en **full-art/hash** (Sunken Temple, Abandoned Hall) — d'où l'utilité de `hash_ids` dans `card_ids.json`.

### Le contrat `mulligan([cartes])`

Sur le modal **Mulligan** (après avoir cliqué le bouton `Mulligan` qui ouvre les 4 cartes d'ouverture) :

1. **Lire la main d'ouverture** : les 4 cartes sont des `img` (w≈292, y≈396) → identifier via `idFromSrc`/catalogue (souvent **full-art/hash**, d'où l'intérêt de `hash_ids`).
2. **Décider** (stratège) quelles ≤2 cartes remplacer.
3. `mulligan(["Defiant Dance","Zhonya's Hourglass"])` → `cardClicks`. Cliquer chaque carte la **marque d'une croix rouge** (toggle) ; le bouton devient **`Mulligan (N)`**.
4. **`browser_batch`** : `left_click` sur chaque `cardClick`, puis `left_click` sur `mulliganButton()` (`Mulligan (N)`).
5. Le mulligan se finalise et le simulateur **enchaîne directement le tour 1** (channel 2 runes + draw 1) — pas d'étape « Keep hand » après confirmation. ⚠️ Le toggle est un **vrai clic** : attention à l'état déjà-marqué (re-cliquer une carte marquée la dé-marque).

### Le contrat `resolve(unit, location)` — résoudre la pile

Modèle (cf. `rules/` §Chain) : la pile = **Chain LIFO**. **Convention de priorité** : je joue → « ok? » → j'attends que l'adversaire passe (« ok »). Puis chaque joueur **résout ses propres cartes**, du haut (LIFO) vers le bas, jusqu'à pile vide ou carte d'un autre joueur. ⚠️ Le **drag de résolution déplace la carte immédiatement** (sim manuel, **pas bloqué** par le moteur) : respecter le « ok » est donc une **convention de jeu**, pas une contrainte technique. (Le bouton « Resolve » semble lié au système de priorité et n'a rien résolu dans nos tests — on n'utilise pas ce bouton.)

**Le geste de résolution = un DRAG** de la carte de la pile vers la **zone cible** (pas le bouton « Resolve », pas le clic droit — son menu n'a pas d'option resolve). Important :
- Chaque joueur résout sur **son propre écran** (je drague les cartes de Claude sur cette instance ; l'adversaire ne peut pas les draguer depuis la sienne).
- `left_click_drag(dragFrom → dragTo)` **fonctionne** (geste synthétique reconnu) — à condition de viser la **bonne zone**. La **base** = la `board-section` large du bas de mon côté (`~875,618`), PAS les zones devant les battlefields (`~374/1007, 502`).
- Une **unité** déposée en base entre **tapped automatiquement** (le sim gère ready/tapped ; certaines unités entrent ready, d'autres tapped).
- Un **sort** qui se résout va au **Trash** (clic droit → `Remove`, ou drag vers la défausse — *à mapper*).
- La **location** se décide au moment de jouer (défaut `base`) ; `resolve(location)` la cible. *[TODO : `battlefield:<nom>` (unités qui entrent directement au combat), drag → Trash pour les sorts, et la boucle `resolveStack()` LIFO multi-cartes.]*

Exécution : `JSON.stringify(window.rift.resolve('base'))` → `{dragFrom, dragTo}` → `left_click_drag(dragFrom, dragTo)`.

### Le contrat `endTurn()` — fin de tour

Raccourci clavier **Space** = finir son tour (une seule pression ; le sim auto-avance les phases jusqu'au tour adverse). ⚠️ Un raccourci clavier n'atteint le jeu que si **le chat n'a pas le focus**.

Exécution : `window.rift.defocus()` (JS) → action `key` **`space`** (outil `computer`). Vérifier dans le log que c'est devenu *« Diplo's turn »*. *(Pattern réutilisable pour les autres raccourcis : `R`=Remove, etc. — toujours `defocus()` d'abord.)*

## Architecture d'exécution

### Sous-agents de décision (`agents/` de cette skill, liés dans `.claude/agents/` par `.skills/sync`)

Deux sous-agents **de réflexion** (read-only, jamais le navigateur — c'est la boucle principale qui lit l'état et exécute les clics) :

- **`riftbound-strategist`** — le GAMEPLAN du matchup. À invoquer dès que la légende adverse est connue, ou quand un signal de révision du plan se déclenche. Input : deck dir, légende adverse, battlefields, infos connues. Output : plan (rôle, chemin de victoire, séquencement Energy/Power, réponses réservées, mulligan).
- **`riftbound-tactician`** — UNE décision de jeu (quoi jouer, attaquer, réagir). À invoquer aux points de décision non triviaux, avec en contexte le gameplan + `readState()` + log + la question. Output : `DÉCISION / POURQUOI / ANTICIPATION / PLAN B / PENDING`, l'action exprimée dans les contrats ci-dessus.

Boucle type : stratège (1× en début de partie) → puis par tour : `readState()` → tacticien → la boucle principale exécute (contrats) → « ok? » → résolution. Les décisions triviales (résoudre une pile validée, channel) ne justifient pas d'invocation.

> **MISE À JOUR 2026-06-30 — exécution DIRECTE, pas de sous-agent.** Le sous-agent « exécuteur » se justifiait pour isoler les screenshots lourds. Mais avec la **lecture JS/DOM**, on n'a plus besoin de screenshots pour exécuter : on lit l'état en texte (léger) et on clique des coords DOM-exactes. Le sous-agent n'apporte plus que de la **latence** (il recharge ses outils, « réfléchit », screenshote). → **Le stratège exécute lui-même**, directement :
> 1. **Lire** l'état via un JS (main/runes/pile/battlefields par zone, coords scalées) → cibler par **set-id DOM** (ex. `OGN-199`), jamais par position.
> 2. **Agir** via `browser_batch` qui enchaîne clics + JS en **un seul aller-retour** (engager runes → jouer carte → poster « ok? » → relire le log).
> 3. **Poster le chat** en JS (avec `i.focus()` !), **vérifier** via lecture JS du log/stack.
>
> Les prompts d'exécuteur ci-dessous restent valables comme **fallback** (tâche lourde isolée), mais le défaut est l'exécution directe. La règle « stop après OK?, n'attends pas » ne s'applique qu'au cas sous-agent ; en direct, le stratège gère naturellement l'attente du « ok ».

### (Référence) Modèle sous-agent — fallback

Une partie génère beaucoup de screenshots (lourds en tokens). Pour garder le contexte de la boucle principale propre, on sépare :

- **Stratège = boucle principale (Opus).** Détient les règles + le plan de deck + l'**état de match** (board, score, mains, pile). Prend **toutes** les décisions, dialogue avec l'adversaire via le chat, décide la prochaine action mécanique.
- **Exécuteur = sous-agent (Sonnet, jamais Haiku).** Reçoit une instruction **mécanique, explicite, par cible/position**, l'exécute dans Chrome, et rapporte un résultat **concis**.

**Faits établis :**
- ✅ **Connectivité prouvée** (sonde 2026-06-30) : un sous-agent partage la session MCP et pilote le **même onglet** (même `tabId`). Pas besoin de re-créer d'onglet.
- ⚠️ **Le grounding visuel de l'exécuteur n'est pas fiable** : en test, Sonnet a mal lu des noms de cartes (a « vu » un Yasuo inexistant). Donc :
  - L'exécuteur **n'est jamais** la source de vérité sur *quelle* carte est où — c'est le stratège qui le sait (à partir de ses propres lectures).
  - Instructions à l'exécuteur = **explicites** (« clique la rune verte Calm en bas-gauche puis la rune violette Chaos », pas « engage le mana »).
  - **Vérification via le LOG texte** (panneau bas-droite), pas via la perception de l'exécuteur.

**Règle d'arrêt de l'exécuteur :** son travail **s'arrête après avoir posté « OK? » dans le chat** — il **n'attend pas** la réponse. Attendre une réponse humaine est un job du stratège, qui reprend la main quand l'utilisateur répond « ok ». (Un exécuteur ne doit jamais bloquer sur un human-in-the-loop.)

**Quand déléguer :** seulement une fois le geste **cartographié et documenté** dans le journal de découverte ci-dessous. Tant qu'un geste est inconnu, le stratège le fait lui-même (en boucle principale) pour le mapper proprement, *puis* le délègue aux tours suivants.

## Exécuteurs — prompts réutilisables (templates)

Le stratège remplit les `{PARAMÈTRES}` à partir d'une capture fraîche, puis lance un sous-agent **Sonnet** (`subagent_type: general-purpose`, `model: sonnet`) avec le prompt rempli. Les coordonnées sont **par-invocation** (elles bougent selon l'état du board).

### Exécuteur #1 — « Jouer une carte » (payer → envoyer sur la pile → demander OK → STOP)

```
Tu es un EXÉCUTEUR mécanique pour le simulateur Riftbound sur TCG Arena (Claude-in-Chrome).
Tu NE prends AUCUNE décision de jeu. Tu exécutes EXACTEMENT les clics ci-dessous, dans l'ordre, puis tu t'ARRÊTES. Tu n'attends JAMAIS de réponse humaine.

SETUP :
- Onglet : tabId {TAB_ID} (groupe MCP déjà ouvert ; NE crée PAS d'onglet, n'utilise pas createIfEmpty).
- Charge les outils en UN appel : ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__computer"
- Ne te fie PAS à ta lecture des cartes (le canvas est trompeur). Suis les COORDONNÉES. La vérité = le LOG en bas-droite.

ACTIONS (ordre exact) :
1. PAYER en engageant les runes — pour CHAQUE coordonnée, un left_click (1 clic = la rune passe à l'horizontale) :
   {RUNES : liste de (x,y)}
2. ENVOYER LA CARTE SUR LA PILE : left_click sur {CARTE : (x,y)}. (Un simple clic suffit. Si rien ne bouge dans le log et qu'un bouton "Play" est apparu sur la carte, clique ce bouton.)
3. DEMANDER OK (programmatique, rapide) — via javascript_tool (action javascript_exec, le code suffit, pas de clic/type) :
   `const i=document.querySelector('input[placeholder*="Chat" i]');i.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'ok?');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));`
   (Succès = l'input se vide. Un seul `keydown` Entrée suffit, pas de form. Voir « post chat en JS » plus bas.)
4. STOP. Prends un dernier screenshot.

RAPPORTE (concis, ton message final = le résultat) :
- Combien de runes sont maintenant horizontales.
- Les 3-4 dernières lignes du LOG (bas-droite).
- "ok?" est-il bien visible dans le chat ?
- Toute anomalie (modal, rien dans le log, etc.) avec le texte exact.
NE résous PAS la carte (ne la déplace pas vers la base) — pas ton rôle.
```

### Exécuteur #2 — « Résoudre la pile » (après le OK adverse → poser la créature dans la base → STOP)

```
Tu es un EXÉCUTEUR mécanique pour le simulateur Riftbound sur TCG Arena (Claude-in-Chrome).
Tu NE prends AUCUNE décision. Tu exécutes le geste ci-dessous puis tu t'ARRÊTES.

SETUP :
- Onglet : tabId {TAB_ID} (NE crée PAS d'onglet).
- Charge les outils en UN appel : ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__computer"
- Ne te fie pas à ta lecture des cartes ; suis les coordonnées. Vérité = LOG bas-droite.

CONTEXTE : la carte {NOM_CARTE} est sur la PILE (affichée en grand). L'adversaire a validé. Il faut la RÉSOUDRE en déposant la créature dans la BASE.

ACTIONS :
1. left_click_drag : start = {PILE : (x,y)} (la carte sur la pile) ; end = {BASE : (x,y)}.
   — Si tu n'es pas sûr de la zone BASE : fais un clic maintenu (grab) sur la carte SANS relâcher → les noms des zones apparaissent → relâche sur "Base".
2. STOP. Screenshot.

RAPPORTE (concis) :
- Les 3-4 dernières lignes du LOG (cherche une ligne confirmant la créature posée/résolue).
- Où est la créature maintenant (base ? encore sur la pile ?).
- Toute anomalie avec texte exact.
```

> Note discovery : la coordonnée **BASE** n'est pas encore cartographiée de façon fiable — utiliser le grab-reveal au premier run pour la fixer, puis l'inscrire dans le journal de découverte.

## Lecture d'état via JS/DOM (méthode privilégiée — découvert 2026-06-30)

**TCG Arena est une app React/DOM, PAS du canvas** (`document.querySelectorAll('canvas').length === 0`). Tout l'état de jeu est dans le DOM → lisible de façon **structurée et fiable** via `mcp__claude-in-chrome__javascript_tool`, sans dépendre de la vision.

**Sélecteur clé : `.game-card`** (un par carte). Pour chacune :
- **Identité** : l'`<img>` de face a un pathname type `.../OGN-068/full-desktop-2x.avif` → le segment `OGN-068` = **set + numéro de collection** → nom via `sets/*/source.json`. (Face cachée = `img src` contient `cardBack-blue.png`.)
- **Zone** : dans la `className` (`Hand`, `Runes`, `Stack`, `Battlefields`, `Base`, `Sideboard`, `Legend`, `Chosen`, `ExileHidden`…). **Détecter par mot-clé, indépendamment de l'ordre** des classes (l'état `tapped` peut précéder le nom de zone).
- **État** : `tapped` dans la className = rune/objet **engagé**.
- **Position** : `getBoundingClientRect()`.

**Le LOG est lisible en texte** depuis le DOM (panneau bas-droite) → source de vérité, sans screenshot.

**Mon côté vs adversaire** : séparer par la coordonnée **Y** (mon côté = bas ; la bordure rouge sépare les deux moitiés).

**⚠️ Échelle de coordonnées (piège critique)** : `getBoundingClientRect()` renvoie l'espace **viewport** (`window.innerWidth` ≈ 1920). L'outil `computer` (clics ET screenshots) travaille en espace **screenshot** (≈ 1568 de large). **Convertir avant de cliquer** :
`clickX = jsX * (1568 / window.innerWidth)` (idem Y avec la hauteur). Lire `window.innerWidth/innerHeight` pour le facteur exact.

**Bruit à filtrer** : `id === 'game_data_live'` (faux positif), et doublons de rendu hors-écran (positions aberrantes type `x:1547,y:945`).

### Read vs Act — la règle

- **READ → JS/DOM.** Fiable, rapide, peu de tokens (texte, pas d'images), zéro erreur de vision. Le stratège lit l'état (`.game-card` par zone + log) et résout les noms via `sets/*/source.json`.
- **ACT → vrais clics** (outil `computer`) **aux coordonnées dérivées du DOM** (getBoundingClientRect → ×échelle). Ça élimine la classe de bugs « coordonnée estimée à l'œil / main qui se réorganise / mauvaise carte ».
  - **NE PAS** simuler d'événements via JS (`.click()`, dispatchEvent) pour AGIR sur l'**état de jeu** : risque de **désync multijoueur** (l'action doit passer par les handlers de l'app qui émettent le message réseau au serveur/adversaire).
- **EXCEPTION — post chat en JS (OK, prouvé 2026-06-30).** Le chat n'est PAS un état de jeu → l'envoyer en JS est sûr et **bien plus rapide** que clic+type+Entrée. Input React → il faut le *native value setter* + event `input` + `keydown` Entrée (un seul keydown suffit, pas de form) :
  `const i=document.querySelector('input[placeholder*="Chat" i]');i.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'ok?');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));`
  L'envoi marche (le keydown déclenche le handler app + l'envoi réseau). ⚠️ **Ne PAS** vérifier `i.value===''` de façon **synchrone** juste après : React vide l'input au render *suivant*, donc une relecture immédiate est un **faux négatif** (piège vécu 2026-06-30). Pour confirmer, `await` un tick ou lire le log. (Dispatcher des events *fonctionne* ; on s'en abstient pour les coups de jeu par prudence anti-désync, pas par impossibilité.)
- **Screenshots = vérification ponctuelle / fallback**, plus la perception primaire.

> Impact sur l'architecture exécuteur : le stratège fournit des coordonnées **DOM-exactes** (plus d'œil), ou mieux — l'exécuteur lit lui-même la coordonnée live de sa cible via JS juste avant de cliquer. À finaliser : un helper JS « lire mon état » réutilisable (main / pile / battlefields / runes ready vs tapped).

## Conventions de lecture d'écran

- Le plateau est en **canvas** : `read_page` expose surtout les boutons HTML (sidebar, chat, emotes), pas les cartes. Pour lire les cartes → `zoom` sur des régions, ou **hover** une carte (aperçu agrandi à droite).
- **Hover sur une carte** = aperçu détaillé grand format (utile pour lire coût/texte d'une carte rognée en bas de la main).
- **Log de partie** = panneau bas-droite : source de vérité pour ce qui s'est passé (`drew`, `played X Rune`, `played <card> from hand`…).
- Ma main est fanned au **bas-centre**, souvent **rognée** par le viewport → hover/zoom pour lire.

## Référence des contrôles (menu Help in-app — SOURCE CANONIQUE)

Le menu **Help** (icône `?` barre latérale gauche → onglets « How to use the app » / « Shortcuts ») documente tous les contrôles. **Toujours le consulter avant de tâtonner.** Les raccourcis clavier s'appliquent à la carte **survolée** (et nécessitent `defocus()` pour ne pas taper dans le chat).

**Gestes souris :**
- **Click carte en main** → la joue (zone par défaut). **Click carte en jeu** → **tap/untap**. **Click carte adverse** → ping.
- **Hold + drag** → déplacer vers la zone voulue (jouer, résoudre pile→base, move→battlefield, vers discard…).
- **Right-click une carte** → quick action menu (créer **tokens**/buffs, To Deck, Remove, Hide, Group, counters…).
- **Left-click un discard** → cartes défaussées ; **right-click** → removed + sideboard. **Left-click deck** → pioche 1 ; **right-click deck** → search/shuffle/Manage top cards. **Shift+drag → deck** = Recycle.
- **Score** : « mark your points at the **bottom left** » → compteur `player-counters` (un `<input>` ; `score(delta)` l'incrémente par native-setter — clic-coord sur les ▲/▼ non fiable).
- **Tokens / status markers** (Buff, Temporary, **sablier ⏳**…) : **center-left menu** (drag l'icône sur la carte/zone). *(N'en créer qu'un de chaque, ajuster le compteur pour la quantité.)*

**Raccourcis clavier** (`defocus()` d'abord, survoler la cible) :
| Touche | Action | Usage |
|---|---|---|
| `Space` | Finir le tour | `endTurn()` |
| `1/2/3` | Zoom zone joueur | |
| `Up`/`Down` | Untap/Tap une **rune** | alt. au clic |
| `Enter` | Envoyer sa 1re réaction | |
| `F` | Jouer **sans payer** le coût | tests/setup |
| `P` | Ping une carte | |
| `S` | Show (avancer, visible fin de tour) | |
| **`D`** | **Send to discard** | **résout un SORT** → Trash |
| `H` | Renvoyer en main | |
| `R` / `Shift+R` | Remove / remove hidden | retirer du jeu (battlefields inutilisés) |
| **`T`** | **Add card effect to the pile** | **triggered abilities** (ex. draw de Scuttle Crab) |
| `I` | Inverser (180°) | |
| `Z` / `Ctrl+Z` | Reveal/hide/flip | cartes **Hidden** |
| `M` | Réarranger une zone | |
| `C` / `Ctrl+C` (+`Shift`=−) | Compteur d'une **carte** +/− | might/buff/damage mods |
| `A` | Mettre la carte au-dessus | |
| `L` | Lier 2 cartes (interaction) | |
| `Ctrl+click` | Sélection multiple | |
| `G` | Group/Ungroup (donner à l'adversaire) | |
| `W` | Move vers la resource area | |

## Journal de découverte (à enrichir au fil des parties)

Section vivante : ajouter ici chaque mécanique d'UI comprise pendant le jeu (déplacer une unité vers un battlefield, déclencher un Showdown, scorer un Conquer, engager pour une Reaction au tour adverse, utiliser les emotes/dés, etc.). But : qu'une prochaine partie n'ait pas à re-découvrir les mêmes gestes.

- **Runes** : 1 clic → horizontale (engagée/exhausted). Réservoir de runes = bas-gauche (compteur), runes channelées = dans la base.
- **Jouer un sort/unité** : hover → **Play** → carte va sur la pile (droite) → résoudre après « ok ».
- **Résoudre la pile → base** : **drag** de la carte (pile `~1454,353`) vers la `board-section` de base (`~875,618`). Unité entre **tapped** auto. Gated par la priorité (les 2 passent). Le bouton « Resolve » et le menu clic-droit ne résolvent PAS.
- **Fin de tour** : `defocus()` puis touche **Space** → passe la main à l'adversaire (1 pression, auto-avance les phases).
- **Move unité → battlefield** : **drag** de l'unité (base) vers la **zone `B1`/`B2` SOUS le battlefield** (⚠️ PAS sur la carte battlefield : `B1`=gauche `~374,502`, `B2`=droite `~1007,502`). La carte prend la classe `B1`/`B2`. Entrer sur un battlefield **non contrôlé/contesté** déclenche un **Showdown** (bouton « Resolve », je gagne le Focus → « ok? » → l'adversaire réagit/passe → Conquer si je gagne). `move([unit], 'battlefield:<nom>')`.
- **Score / Conquer** : `score(+1)` (compteur bas-gauche, input native-setter). À faire quand je conquiers (Conquer = 1 point).
- **Sort → discard (Trash)** : survoler le sort + touche **`D`** ; **`T`** ajoute un trigger à la pile.
- **Effets en attente (delayed / end-of-turn)** : poser un **token visuel** (sablier ⏳ depuis le **center-left menu**, drag sur la carte/zone) pour la visibilité partagée, **ET** tenir une **liste textuelle** des effets pending (pour les exécuter au bon moment). Ex. Targon's Peak conquis → ⏳ sur Targon + note « fin de tour : ready 2 runes ».
- *(à compléter : Showdown contesté/combat réel, résolution LIFO multi-cartes…)*

## Garde-fous

- **Payer AVANT de jouer** (engager les runes). Ne pas supposer que le simulateur déduit l'énergie tout seul.
- **Demander « ok? » au chat** avant de résoudre une carte mise sur la pile (sauf trivial début de partie).
- **Login / credentials = jamais Claude.**
- Croiser chaque règle moteur avec `rules/` + `memory/rules_traps.md` (Domain ≠ rune cost, Neutral ≠ combat trick, Recall ≠ Move, Hidden…).
- Décisions stratégiques (choix de battlefield, premier joueur, mulligan, lignes de combat) : les **expliquer** (le « why ») — c'est la préférence utilisateur (`memory/user_profile.md`).
