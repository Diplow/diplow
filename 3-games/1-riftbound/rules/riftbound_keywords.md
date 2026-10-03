# Riftbound — Mots-clés & rulings d'interaction
 
> Aide d'étude **paraphrasée**, compilée le 2026-06-28. Pas le texte officiel.
> Sources : Core Rules / ORD, **Riftbound FAQ officiel** (riftboundfaq.com), patch notes Spiritforged,
> guides communautaires. Voir aussi `riftbound_general_rules.md` (moteur) et `riftbound_format_generator.py` (légalité datée).
> ⚠️ Les rulings peuvent évoluer ; recouper avec le Rules Hub avant un événement.
 
---
 
## A. Mots-clés de combat / défense
 
- **Might** — Force de combat. Dégâts ≥ Might actuel = létal.
- **Shield (N)** — **+N Might tant que l'unité est défenseur** (défaut N=1). Sans effet à l'attaque.
- **Tank** — L'unité **doit être assignée les dégâts de combat en premier** (protège les autres unités présentes).
- **Mighty** — État : une unité est **Mighty tant qu'elle a 5+ Might** (référencé par des payoffs type Deathknell).
- **Assault (N)** — **+N Might tant que l'unité est attaquant** (le pendant offensif de Shield).
- **Stun** — L'unité **ne fait pas de dégâts de combat ce tour**. Temporaire, mono-cible.
  Outil de tempo défensif contre un gros Might / un attaquant (n'enlève rien définitivement).
---
 
## B. Mots-clés de protection / résilience
 
- **Deflect** — Les adversaires doivent **payer 1 Power supplémentaire** pour choisir l'unité
  avec un sort ou une capacité. **Ne protège PAS** contre le combat pur (un plus gros Might)
  ni contre les effets non-ciblés.
- **Temporary** — L'unité/carte est temporaire (meurt/expire selon son texte, typiquement au début de ton tour).
  *Note :* un keyword inactif **existe encore** et peut être référencé par d'autres effets.
---
 
## C. Mots-clés de tempo / déplacement
 
- **Accelerate** — Tu peux payer un **coût additionnel** pour que l'unité **entre Ready**
  (contourne le « entre exhausted » par défaut).
- **Ganking** — L'unité peut **se déplacer de battlefield à battlefield** (pas seulement depuis/vers la base).
  Combine très bien avec les effets qui **ready** une unité (attaque un field, ready, repart sur un autre).
- **Hunt** — L'unité gagne **1 XP** quand elle conquiert ou tient (Hold). Carburant pour les capacités à XP / Level.
- **Deathknell** — Effet déclenché **à la mort** de l'unité.
- **Buff** — Donner un **+1 Might buff** à une unité **si elle n'en a pas déjà un** (une unité ne porte qu'un buff,
  sauf effet l'amplifiant).
---
 
## D. Mots-clés d'équipement (Spiritforged) — et le ruling central « attach = choose »
 
### Equip {couleur}
Capacité activée : payer le coût Equip et **choisir une unité que tu contrôles** pour y attacher le gear.
- **RULING — Equip compte comme « choisir une unité ».** Le choix de l'unité **est une cible**,
  donc activer Equip déclenche les effets « when you choose a friendly unit ».
### Quick-Draw
Permet de **jouer un Equipment depuis la main à vitesse Reaction** et de l'**attacher directement,
sans payer le coût Equip**. Inclut Reaction. Ne change pas *quand* on peut utiliser la capacité Equip plus tard.
- La capacité déclenchée de Quick-Draw va **séparément sur la Chain** → l'adversaire peut **réagir avant l'attache**.
- **RULING — Quick-Draw compte aussi comme « choisir une unité »** (sa capacité te fait choisir l'unité d'attache).
### Weaponmaster
Play Effect : **choisit un Equipment** que tu contrôles, puis te laisse payer son coût Equip
**réduit de 1 Power** pour l'attacher à l'unité Weaponmaster. Peut viser un équipement **déjà attaché ailleurs**.
- **RULING — Weaponmaster NE compte PAS comme « choisir une unité »** (il choisit l'**équipement**, pas l'unité).
> **Pourquoi ça compte (archétype Irelia Blade Dancer) :** « choose a friendly unit » est le déclencheur
> central de l'archétype. Comme **Equip et Quick-Draw choisissent l'unité**, chaque attache d'équipement
> nourrit le moteur (Légende → ready, Irelia → +1 Might, Spirit Wheel → pioche, etc.). **Weaponmaster, lui, ne le nourrit pas.**
 
---
 
## E. Mots-clés de cartes / timing
 
- **Action** — Jouable/activable **à ton tour** et **pendant les showdowns** (si tu as le Focus).
- **Reaction** — Jouable/activable **à tout moment**, même en Closed State / pendant le tour adverse, avant résolution d'autres effets.
- **Vitesse par défaut (Neutral-only)** — Une carte **sans** mot-clé de timing, **et une capacité activée sans [Reaction]/[Action]**,
  ne peut être jouée/activée qu'**à ton tour, en état Neutre** (aucun showdown en cours, aucune Chain ouverte).
  - **RULING — une capacité activée n'est PAS un combat trick par défaut.** Ex : **Heart of Dark Ice** (« [exhaust] : +3 Might »)
    n'a pas [Reaction] → elle se joue **avant** d'engager le combat, à ton tour ; **impossible de l'activer pendant un showdown** (le tien ou l'adverse).
    Pour pump en combat, il faut des sorts [Reaction] (Discipline, Feral Strength, Defiant Dance) ou un Equipment **Quick-Draw**.
- **Hidden** — Tu **caches la carte face cachée maintenant** (coût 1 Power) pour la **rejouer plus tard en Reaction pour 0 Énergie**.
  Sert à **lisser la courbe** et à **bluffer**. *(Battlefield support : Bandle Tree permet de cacher une carte de plus.)*
  - **On ne cache qu'à un battlefield que l'on CONTRÔLE** (donc pas au tour 1, pas sur un battlefield neutre/adverse).
  - La carte cachée **ne se révèle jamais sous la contrainte adverse**. Elle est **retirée au cleanup** s'il n'y a
    **plus d'unité amie présente** à ce battlefield (critère = présence d'unité, pas contrôle nominal).
    → Quand l'adversaire conquiert en tuant tes unités là, ta carte cachée **part au cleanup** (perdue, pas jouée).
  - Implication : Hidden est un outil de **quand tu es déjà installé**, pas un filet quand tu perds le board.
- **Repeat (coût)** — **Coût additionnel optionnel** : exécute l'effet du sort **une fois de plus**.
  Payable **une seule fois**. Compte comme **avoir joué le sort une seule fois**.
  Les **choix des deux exécutions** se font au **même** step « Make relevant choices ».
  *(Battlefields support : Marai Spire réduit les coûts Repeat de 1 ; The Academy peut donner Repeat à un sort.)*
### Recall vs Move (distinction officielle, errata)
- **Move** (déplacement) — déclenche les effets **« when I move »** (ex. Apprentice Smith, Traveling Merchant).
  *Inclut* un effet qui dit explicitement « Move a friendly unit … to its base » (ex. **The Syren** → re-déclenche les « on move »).
- **Recall** — texte officiel : **« Send it to base. This isn't a move. »** Donc **recall ≠ move** et **ne déclenche PAS** les « when I move ».
  - Ex : le **recall de Guardian Angel** (sauvetage) ne déclenche **pas** Apprentice/Merchant. The Syren (qui dit *Move*), si.
  - Note combat : sur une **égalité** de combat (les deux camps gardent des unités), **les attaquants sont recall** (renvoyés en base, sans trigger « move »).
---
 
## F. Ressources additionnelles
 
- **Gold** — Jeton-gear généré par certains Legends/Champions. Dépenser 1 Gold (détruire le jeton)
  = **+1 Power de n'importe quel domaine**. Ramp/fixation, surtout pour les tours lourds en fin de partie.
---
 
## G. Ruling détaillé — interaction « choose / ready » (modèle Irelia, utile au-delà d'Irelia)
 
Ces points illustrent comment fonctionnent les triggers « when you choose » et « when … readies » en général.
 
1. **Le trigger « on choose » part au moment du choix**, à l'étape « Make relevant choices »,
   **avant** que l'adversaire puisse réagir et **indépendamment de la résolution**.
   → **Contrer** le sort qui choisit n'annule **pas** le trigger « on choose » déjà déclenché.
   - **Ce qui compte comme « choisir une unité » :** agir **directement** sur une unité — la cibler (sort/capacité),
     l'**attacher** un Equipment (Equip/Quick-Draw), la **déplacer** (ex. Syren « move a friendly unit », Tideturner « choose a unit you control »).
     **Ne compte pas :** une unité seulement mentionnée dans un coût, une condition de trigger, ou comme repère pour identifier une autre cible
     (d'où **Weaponmaster**, qui choisit l'équipement, exclu).
2. **« Ready it » d'un effet (ex. Légende Blade Dancer) ne re-choisit rien** : « it » renvoie
   déterministiquement à l'unité déjà identifiée comme condition du trigger (pas de nouvelle cible).
3. **Un trigger « when I'm readied » ne se déclenche que si l'unité transitionne réellement
   d'exhausted → ready.** Si elle est déjà Ready, la « readier » ne fait rien → pas de trigger.
   - Cas pratique : un effet qui « ready » Irelia ne donne le bonus « ready » **que si elle était exhausted**.
   - Le ready de l'**Awaken Phase** déclenche aussi le trigger si l'unité était exhausted.
4. **Repeat + trigger « on choose » :** choisir la même unité pour les deux instructions d'un sort à Repeat
   = **deux events de choix distincts** → le trigger « on choose » se déclenche **deux fois**.
   - Exemple (Feral Strength sur Irelia, Repeat payé) : +1 +1 (ability d'Irelia) + 2 + 2 (sort) = **+6 Might** ce tour.
---
 
## H. Rappels d'attachement (résumé ; détail système dans general_rules §10)
 
- Equipment = 2 temps (jouer en base, puis Equip). Empilable sans limite. Texte du haut **inactif** une fois attaché.
- À la mort du porteur : l'équipement **revient en Base** (pas au Trash) → résilient.
- L'adversaire peut **réagir avant** que l'attache (Equip / Quick-Draw / Weaponmaster) résolve.
