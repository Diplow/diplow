---
type: methode
domaine: [théorie, politique-intérieure]
thèmes: [le-Graphique, élections, analyse-de-classe]
etapes:
  - "Identifier la PCS de chaque groupe analysé selon la nomenclature INSEE"
  - "Positionner chaque PCS sur l'axe X (exploitation) : calculer la proportion de capital d'entreprise/foncier vs flux salarial dans le patrimoine de la PCS"
  - "Positionner chaque PCS sur l'axe Y (domination) : reprendre le rang hiérarchique INSEE (ouvrier spécialisé → cadre dirigeant)"
  - "Calculer le barycentre pondéré d'un électorat par PCS (composition) — pas le taux de vote d'une PCS pour un candidat (captation)"
  - "Lire la diagonale de pouvoir : classer les PCS au-dessus (espace révolutionnaire), sur la diagonale (méritocratie apparente), ou en dessous (espace réactionnaire)"
  - "Tester si le clivage est parallèle à la diagonale (clivage de classe) ou perpendiculaire (clivage générationnel/de mode de production)"
skill_version: write-methode-2026-05-01
aliases: [Le Graphique, Saint Graphique, Graphique de Positions Revue, le graphique]
---
#domaine/théorie #domaine/politique-intérieure #thème/le-Graphique #thème/élections #thème/analyse-de-classe

# Le Graphique

## Définition

Outil d'analyse sociologique électorale conçu par [[Chris]] et [[Positions Revue]], fondé sur une Analyse des Correspondances Multiples (ACM) appliquée aux Professions et Catégories Socioprofessionnelles (PCS) de l'INSEE. Il positionne chaque PCS sur un plan à deux axes — exploitation (Marx) et domination (Bourdieu) — puis localise les candidats et partis au barycentre pondéré de leurs électorats, révélant la nature de classe d'une configuration politique plutôt que sa surface idéologique.

## Mécanisme

### Étape 1 — Construire l'axe horizontal (exploitation)

L'axe X mesure le rapport au capital : à gauche, les PCS dont le patrimoine est constitué exclusivement de flux salarial ; à droite, celles dont le patrimoine comprend du capital d'entreprise, du foncier agricole ou des portefeuilles d'actifs. Les données proviennent des statistiques INSEE sur la composition du patrimoine par PCS. Exemple concret : les agriculteurs sur grande exploitation se retrouvent plus à droite que les chefs d'entreprise de 10+ salariés parce que leur capital foncier dépasse celui de certains patrons. Les fonctionnaires sont pondérés vers le centre : ni exploiteurs ni exploités, distribués sur tout l'axe vertical selon leur catégorie (A = dominant, C = dominé).

### Étape 2 — Construire l'axe vertical (domination)

L'axe Y reprend directement la nomenclature PCS 2020 de l'INSEE, qui hiérarchise de l'ouvrier spécialisé au cadre dirigeant. Il mesure la **qualification sociale** (position dans la hiérarchie de la division du travail, capital scolaire reconnu), non la qualification technique. Un boulanger très qualifié techniquement mais titulaire d'un CAP se retrouve en bas, non parce qu'il ne sait pas travailler, mais parce que la société valorise la hiérarchie éducative. Ce décalage entre savoir-faire et valorisation sociale est précisément ce qui rend les artisans oppositionnels.

### Étape 3 — Produire le ranking et placer les PCS

L'algorithme — artisanal, à terme ouvert en open source — croise les deux variables et produit un score de -10 à +10 sur chaque axe. Le plan résultant prend la forme d'une double ellipse : les PCS s'organisent en X, confirmant que classe et domination sont des dimensions distinctes. La taille de chaque rond est proportionnelle à la masse électorale de la PCS (les anciens employés/ouvriers retraités sont les plus gros ronds).

### Étape 4 — Positionner les candidats par composition (pas par captation)

C'est l'étape centrale et la plus contre-intuitive. La **captation** dit : « 40 % des ouvriers votent Le Pen ». La **composition** dit : « l'électorat de Le Pen est composé à X % d'ouvriers, ce qui la positionne ici ». Un candidat à 1 % composé à 100 % d'ouvriers sera plus en bas-gauche qu'un candidat à 40 % chez les ouvriers mais aussi 60 % de cadres. Le barycentre pondéré est calculé en croisant les parts d'électorat et les positions PCS. C'est la composition qui révèle la nature de classe d'un électorat — la captation ne révèle que la popularité relative.

### Étape 5 — Lire la diagonale de pouvoir

La [[Diagonale de pouvoir]] va du coin bas-gauche au coin haut-droite. Sur cette diagonale, capital et pouvoir de direction sont proportionnels : la méritocratie « fonctionne » et les individus intériorisent leur position comme méritée. L'école joue un rôle central dans cette intériorisation.

- **Au-dessus de la diagonale (haut-gauche)** : classes ayant beaucoup de pouvoir de direction mais peu de capital en regard. Position structurellement instable, potentiellement révolutionnaire — elles constatent une dissymétrie entre leur place dans la production et leur rétribution. Exemples : jeunes ingénieurs, professions intermédiaires en cours de prolétarisation.
- **En dessous de la diagonale (bas-droite)** : classes ayant du capital mais peu de pouvoir de direction. Classes réactionnaires qui fantasment un retour à un statut antérieur. Exemples : artisans, petits commerçants, retraités propriétaires.

### Étape 6 — Identifier le type de clivage (parallèle vs perpendiculaire)

Pour tout sujet (une question de sondage, un débat de société), on projette la diagonale oui/non sur le Graphique :
- **Diagonale parallèle** à la diagonale de classe → clivage de classe : les positions reflètent les rapports de production. Exemple : Charlie Hebdo (pro-caricature = classes supérieures, anti-caricature = classes populaires).
- **Diagonale perpendiculaire** à la diagonale de classe → clivage transclasse, générationnel ou de mode de production. Exemple : le cannabis (les actifs de toutes PCS sont au « non » à la pénalisation, les retraités au « oui » quelle que soit leur classe).

Une nuance supplémentaire : le clivage peut être *parallèle mais décalé*, introduisant une composante générationnelle secondaire sans en faire un clivage générationnel pur.

## Exemples d'application

**Présidentielle 2027 — prophétie du 2002 inversé**
Dans [[COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR]] et [[Hollande vs Melenchon 2e tour]], le Graphique est mis en regard sur trois élections : 2002 (éparpillement, abstention centrale transclasse), 2022 (consolidation des blocs, diagonale de lutte des classes), 2027 (retour à l'éparpillement — mais à droite). La clé analytique : partager le même espace dans le Graphique signifie partager les mêmes rapports matériels, pas la même idéologie. [[Jean-Luc Melenchon]], [[Marine Le Pen]] et l'abstention occupent le même espace populaire — leur conflit est structurel, pas contingent.

**Analyse du NFP — composition vs barycentre**
Dans [[Faut-il en finir avec le NFP]], le Graphique démontre que l'union de la gauche déplace son barycentre vers des catégories bourgeoises et diplômées. La NUPES de juin 2022 est déjà au-dessus de la position de Mélenchon en avril 2022 ; le NFP de juillet 2024 encore plus. Plus l'alliance s'élargit, plus elle s'éloigne de l'espace populaire où se joue le conflit avec le RN.

**Clivage Charlie Hebdo — clivage de classe parallèle**
Dans [[CHARLIE HEBDO EST-IL REACTIONNAIRE]], le Graphique est appliqué à un sondage Ifop sur le droit à la caricature. La diagonale oui/non est parallèle à la diagonale de classe : les classes supérieures défendent la caricature illimitée, les classes populaires (qui subissent ces caricatures) s'y opposent davantage. Comparé au cannabis (perpendiculaire = clivage générationnel), la méthode tranche le débat sans recourir à l'idéologie.

**Prédiction 2022 — validation empirique**
Dès janvier 2022, [[Chris]] projette [[Jean-Luc Melenchon]] à ~22 % à partir de la distribution structurelle du Graphique croisée avec les [[Google Trends prediction electorale|Google Trends]]. Résultat final : 21,95 %. [[Eric Zemmour]], annoncé à 18 % par les sondages, prédit à 7-8 % par le Graphique — score final dans cet ordre. Cette double validation consolide la légitimité prédictive de l'outil contre la sondagerie.

## Concepts dérivés

[[Diagonale de pouvoir]] — ligne méritocratique, discriminant espace révolutionnaire (haut-gauche) et espace réactionnaire (bas-droite).

[[Heterogeneite du salariat]] — ce que le Graphique rend visible : les différences internes au salariat que la catégorie abstraite des « 99 % » ou du « monde du travail » masque.

[[Conflictualite interne aux classes populaires]] — Mélenchon et Le Pen dans le même espace de classe : le clivage central n'est pas droite/gauche mais pacte égalitaire vs pacte raciste à l'intérieur des classes populaires.

[[Dimensions tierces du Graphique]] — genre et race encodés à l'intérieur des ronds (PCS) : la proportion de racisés augmente vers le bas-gauche, la proportion de femmes varie selon les PCS. Ce sont des filtres de lecture à l'intérieur du plan 2D, pas un troisième axe.

[[Clivage materiel vs clivage de valeurs]] — les classes populaires (bas-gauche) se polarisent sur des questions matérielles (salaire, retraite, pénurie) ; les classes supérieures (haut-droite) sur des questions de valeurs (laïcité, civilisation, identité). L'espace dans le Graphique détermine les débats qui mobilisent.

[[Clivage generationnel]] — diagnostic produit par la méthode quand la diagonale oui/non est perpendiculaire à la diagonale de classe.

[[Barycentre electoral]] — technique concrète de calcul du positionnement des candidats en composition.

[[Moisation]] — concept historique dérivé : la période 2002-2022 de condensation des blocs, lisible sur les Graphiques successifs comme mouvement des barycentres.

## Adversaires méthodologiques

**La sondagerie (captation)**
La lecture standard des sondages raisonne par captation : « X % d'ouvriers votent pour Y ». Elle révèle une popularité relative mais masque la nature de classe d'un électorat. Un candidat à 1 % composé à 100 % d'ouvriers est plus ancré dans les classes populaires qu'un candidat à 40 % chez les ouvriers mais 60 % chez les cadres. La captation est aussi biaisée par le biais déclaratif (sous-représentation des partis populaires) — visible dans [[SONDAGE ANTI-MELENCHON L IFOP MET L EXTREME DROITE A 62 AU 1ER TOUR]].

**L'approche bourdieusienne (capitaux cumulés)**
Bourdieu classe par volume et composition de capitaux accumulés (économique, culturel, social). Le Graphique classe par [[Rapports de production]] — la manière dont on accumule le capital, pas le montant possédé. Un salarié et un artisan à 3 000 €/mois sont dans la même case chez Bourdieu, mais dans des classes opposées sur le Graphique. La critique PaduTeam : le graphique de Bourdieu n'a « aucune data derrière », il ne prédit pas le vote et ne produit pas de distinctions opérantes sur les comportements politiques de masse (voir [[Les LIVREURS-UBER + BOURGEOIS que les MEDECINS]]).

**Le réductionnisme « 99 % vs 1 % »**
La vision binaire (bourgeois vs travailleurs) empêche de comprendre pourquoi les salariés ne votent pas de la même façon, ne portent pas les mêmes projets politiques et ne forment pas un sujet politique unifié. L'[[Heterogeneite du salariat]] — rendue visible par le Graphique — est précisément ce que cette abstraction occulte. Voir [[Debunk Graphique Bad Mulch]].

**La pensée idéaliste (programme, idées, discours)**
La thèse que les bonnes idées et un bon discours peuvent unifier une coalition trans-classe est battue en brèche par le matérialisme du Graphique : les positions dans les rapports de production créent des structures mentales et des intérêts divergents que le discours seul ne peut pas résoudre. « Il résout des problèmes tout seul sur un PowerPoint, indépendamment de savoir si ce possible-là est réalisable vu la configuration sociale actuelle. » (Chris, [[Debunk Graphique Bad Mulch]])

## Vidéos où elle est mobilisée

- [[La CARTE DES QI version MARXISTE le GRAPHIQUE de Positions Revue]] — capsule pédagogique de référence : explication complète des deux axes, distribution de toutes les PCS, construction de l'algorithme, puis analyse électorale comparative 2017/2022/européennes 2024 par barycentres en composition
- [[2 MALES TOXIQUES MARXPLIQUENT le GRAPHIQUE]] — capsule fondamentale : les deux axes, la [[Diagonale de pouvoir]], les espaces révolutionnaire/réactionnaire, la socialisation vs désocialisation ; application à la profession médicale
- [[Debunk Graphique Bad Mulch]] — masterclass pédagogique : réponse technique à [[Bad Mulch]], explication de l'algorithme (composition du patrimoine par PCS), critique du réductionnisme des 99 % et de la pensée idéaliste
- [[Faut-il en finir avec le NFP]] — démonstration la plus complète : rubans électoraux 2002-2024 par bloc, zoom intra-bloc, positionnement de tous les candidats majeurs par PCS avec barycentres, preuve que le NFP déplace le barycentre vers la bourgeoisie
- [[COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR]] — vidéo fondatrice de la prophétie : trois Graphiques mis en regard (2002, 2022, 2027), scores chiffrés de la projection, lecture de l'abstention déportée à droite
- [[Hollande vs Melenchon 2e tour]] — démonstration pédagogique : 16 candidats de 2002 positionnés sur le Graphique, 2012 comme dernier moment pré-moïsation, projection 2027 multivers avec le « mulet Hollande »
- [[CHARLIE HEBDO EST-IL REACTIONNAIRE]] — application à un objet culturel : sondage Ifop repondéré ACM, démonstration du critère parallèle/perpendiculaire, distinction racisme de pénurie vs racisme civilisationnel
- [[Cannabis Rasta Roussel vs Douanier Roussel]] — démonstration du clivage générationnel (diagonale perpendiculaire) vs clivage de classe (parallèle), sur le cannabis ; [[Fabien Roussel]] inadéquat à la structuration réelle des actifs
- [[Les LIVREURS-UBER + BOURGEOIS que les MEDECINS]] — distinction systématique Graphique vs Bourdieu : rapports de production vs capitaux cumulés ; artisans, livreurs Uber, médecins
- [[LORDON MELENCHON peut GAGNER en 2027]] — description technique précise du ranking ACM (-10 à +10) ; validation convergente par [[Frederic Lordon]] qui arrive aux mêmes conclusions sans nommer l'outil
- [[SONDAGE ANTI-MELENCHON L IFOP MET L EXTREME DROITE A 62 AU 1ER TOUR]] — démonstration du biais sondagier : isomorphisme entre le sondage IFOP 2026 et la dispersion réelle de 2012, « graphicide » opéré sur les données de l'IFOP lui-même
- [[L'ILLUSION DE VILLEPIN POURQUOI IL NE PEUT PAS GAGNER EN 2027]] — exercice de prédiction pure par le Graphique élection par élection (2017, 2022, 2024) ; présentation de la version interactive avec zoom PCS
- [[Faure oblige de trahir]] — rappel pédagogique complet, application aux européennes 2024, annonce des développements futurs (dimensions tierces, données Piketty, ouverture du code)
- [[Nicolas qui paye]] — application au vote des cadres seuls en 2017 et 2022, gauchisation visible (Mélenchon 15 % → 20 %), effondrement de la droite dans cette catégorie
