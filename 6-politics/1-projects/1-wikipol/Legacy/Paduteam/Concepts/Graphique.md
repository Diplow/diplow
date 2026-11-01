---
type: concept
couche: methode
domaine: [théorie]
thèmes: [élections]
aliases: [Saint Graphique, Le Graphique, le graphique, Le Saint Graphique]
date created: Monday, March 30th 2026, 3:05:06 pm
date modified: 2026-04-25
---
#domaine/théorie #thème/le-Graphique #thème/élections

# Le Graphique

## Définition
Outil d'analyse sociologique électorale créé par la [[PaduTeam]], basé sur une Analyse des Correspondances Multiples (ACM) des Professions et Catégories Socioprofessionnelles (PCS) de l'INSEE. Deux axes structurent le plan : exploitation (Marx) en abscisse et domination (Bourdieu) en ordonnée. Chaque "rond" représente une PCS positionnée selon ces deux dimensions.

## Structure
Deux axes principaux:
- **Axe horizontal (exploitation)**: inspiré de Marx — oppose les exploités (gauche) aux exploiteurs (droite)
- **Axe vertical (domination)**: inspiré de Bourdieu — oppose les dominés (bas) aux dominants (haut)

### Piège : domination ≠ qualification technique
L'axe vertical mesure la **qualification sociale** (reconnaissance par le capital scolaire, position dans la hiérarchie de la division du travail), pas la qualification technique. Un boulanger peut être très qualifié techniquement mais se retrouve en bas du Graphique parce qu'il n'a qu'un CAP/BP. Un fonctionnaire de catégorie A se retrouve en haut même s'il occupe un poste moins exigeant techniquement. Ce que la société valorise, c'est la hiérarchie éducative, pas le savoir-faire artisanal. C'est pour cela que les artisans ressentent une injustice : ils ont du savoir-faire mais pas la valorisation sociale correspondante.

## Les 4 quadrants
- **Haut-droite**: [[Bloc bourgeois]] / néolibéral (ex: [[Horizon]], Macron 2022)
- **Haut-gauche**: Gauche système / institutionnelle (ex: [[Parti Socialiste]], [[Europe Ecologie Les Verts|Europe Écologie Les Verts]])
- **Bas-gauche**: Gauche antisystème / populaire (ex: [[France Insoumise]], [[Revolution Permanente|Révolution Permanente]])
- **Bas-droite**: Droite antisystème / populaire (ex: [[Rassemblement National]])

## Le "Saint Graphique" — un trait d'humour récurrent
La PaduTeam parle régulièrement du "**Saint** Graphique" sur un ton volontairement sacralisant et humoristique. Ils aiment se présenter comme de simples "interprètes" ou "serviteurs" du Graphique, comme s'il s'agissait d'un oracle. C'est un running gag de la chaîne, pas une appellation sérieuse — l'outil reste un graphique d'analyse sociologique, rien de sacré.

## Détails techniques (algorithme)
L'algorithme a été codé de manière artisanale. Il utilise les données INSEE sur la composition du patrimoine des PCS de niveau 2. Variables d'entrée :
- Composition du patrimoine : flux bancaire salarial vs patrimoine d'entreprise (axe horizontal)
- Statut social : être fonctionnaire pondère vers le centre (ni exploitant ni exploité)
- Hiérarchie PCS : cadre > profession intermédiaire > employé > ouvrier qualifié > ouvrier non qualifié (axe vertical)
- L'algorithme classe de -100 à +100 sur chaque axe

Construction concrète expliquée dans la capsule [[La CARTE DES QI version MARXISTE le GRAPHIQUE de Positions Revue|Capsule Graphique Positions Revue]] :
- **Axe vertical (domination)** : reprend directement la nomenclature PCS 2020 de l'INSEE, qui hiérarchise de l'ouvrier spécialisé au cadre dirigeant — pas de travail supplémentaire, c'est la hiérarchie normée par l'INSEE
- **Axe horizontal (exploitation)** : utilise les statistiques INSEE sur la composition du patrimoine par PCS — proportion de propriétaires (ex : "dans les ouvriers spécialisés il y a 1% de gens propriétaires"), portefeuilles d'actions, patrimoine immobilier, revenus du capital vs revenus du travail. Plus une PCS détient du patrimoine, plus elle est décalée à droite

Exemple de cas-limite éclairant : les agriculteurs sur grande exploitation sont **plus à droite** que les chefs d'entreprise de 10+ salariés, parce qu'ils sont des grands propriétaires fonciers dont le capital dépasse celui de certains patrons qui peuvent eux avoir une entreprise mais travailler encore.

Un projet est en cours pour rendre l'algorithme public (Open Source) et permettre d'ajouter des données supplémentaires (tranches d'âge à l'intérieur des PCS, croisements plus fins). Le graphiste/miniaturiste collabore sur la version interactive.

## Mécanique du ranking

Dans le transcript de [[LORDON MELENCHON peut GAGNER en 2027]], la PaduTeam donne une description technique précise du Graphique :

> "En fait, c'est ce qu'on appelle en statistique, en mathématiques, une matrice ACM sur lequel on va essayer de distribuer une note, un ranking. Les unités vont de -10 à +10. Et en fait derrière, il y a un algorithme en fonction du taux de propriété, du niveau de diplôme sur l'axe y et cetera. Quand vous êtes cadre, sur l'axe y vous êtes rankqué plus haut que quand vous êtes exécutant. Quand vous avez beaucoup plus de capital de votre entreprise, même si c'est une petite entreprise, on considère en marxiste que ça détermine votre rapport au travail et donc vous êtes rankqué plus à droite que si vous êtes seulement salarié."

Le ranking de -10 à +10 est produit par un algorithme croisant :
- **Axe X (exploitation)** : taux de propriété du capital → plus propriétaire = plus à droite
- **Axe Y (domination)** : niveau de diplôme, statut cadre/exécutant → plus cadre = plus haut

## Vote en composition (barycentre)
Technique de lecture du Graphique expliquée en détail dans la vidéo sur le NFP. Chaque candidat/liste est positionné au barycentre pondéré de ses électeurs par PCS. Un candidat qui n'a que des ouvriers dans son électorat sera positionné sur le point "ouvriers". Un candidat avec un électorat mixte sera au centre de gravité des PCS qui le composent. Cela signifie que la position d'un candidat révèle la composition de classe de son électorat, pas juste son programme.

La taille des points (PCS) correspond à leur masse électorale — les anciens employés/ouvriers retraités sont les plus gros points car les plus nombreux. Le barycentre général de la société française est légèrement en bas à gauche du centre, reflétant une majorité d'exploités/dominés, mais pas aussi décalé que dans un pays sans classe moyenne.

## Composition vs captation
Distinction fondamentale pour lire le Graphique. La *captation* dit "40% des ouvriers votent Le Pen" (lecture sondagière classique). La *composition* dit "l'électorat de Le Pen est composé à X% d'ouvriers, ce qui la positionne ici sur le Graphique". Un candidat à 1% composé de 100% d'ouvriers sera plus en bas-gauche qu'un candidat à 40% chez les ouvriers mais aussi 60% de cadres. C'est la composition qui révèle la nature de classe d'un électorat, pas la captation.

## Distinction avec Bourdieu (rapports de production vs capitaux)
Le Graphique se distingue fondamentalement de l'approche bourdieusienne. Bourdieu classe par volume et composition de capitaux accumulés. Le Graphique classe par [[Rapports de production]] — la manière dont on accumule le capital, pas le montant accumulé. La PaduTeam critique le graphique de Bourdieu comme ayant "aucune data derrière". Un salarié et un artisan à 3 000 € sont dans la même case chez Bourdieu, mais dans des classes totalement différentes sur le Graphique — et c'est cette différence qui prédit le vote.

## Utilisations
- Cartographier le positionnement sociologique des candidats et partis
- Analyser les dynamiques de report de voix entre tours
- Comprendre l'[[Éclatement du bloc central]]
- Projeter les résultats électoraux (ex: 2027)
- Comparer les configurations historiques (2002 vs 2022 vs 2027)
- Prédiction électorale croisée avec [[Google Trends prediction electorale|Google Trends]] (Mélenchon prédit à ~22%, résultat 21,95% ; Zemmour prédit à 7-8%, annoncé à 18% par les sondages)
- Analyse des coalitions de classe (ex: [[Bloc bourgeois]])
- Lecture des [[Dimensions tierces du Graphique]] (genre et race encodés dans les ronds)
- Identification des [[Clivage materiel vs clivage de valeurs|clivages matériels vs de valeurs]]

## Évolution historique
- **2002**: éparpillement total, abstention centrale et transclasse, pas de bloc central, espace vide en bas-gauche (futur espace Mélenchon)
- **2012**: deux pôles distincts — en bas à gauche (Mélenchon/FN), en haut à droite (Hollande/Sarkozy). Le Front de gauche en alliance avec le PCF capte les classes populaires, pendant que la droite historique UMP/PS se partage le haut du Graphique. Bayrou à ~15% (10% en 2012) dans l'espace du centre-droit, Eva Joly en haut gauche
- **2022**: agrégation des blocs, [[Jean-Luc Melenchon]] consolide la gauche populaire, Macron solidifie le [[Bloc bourgeois]], [[Marine Le Pen]] se déporte vers les classes populaires — diagonale de lutte des classes
- **2027**: retour à l'éparpillement (comme 2002), [[Éclatement du bloc central]], abstention se déplace à droite (retraités), classes populaires se remobilisent à gauche — fin de la boucle ouverte le 21 avril 2002

## Isomorphisme sondage IFOP 2026 / résultats réels 2012
La PaduTeam identifie dans [[SONDAGE ANTI-MELENCHON L IFOP MET L EXTREME DROITE A 62 AU 1ER TOUR]] une correspondance structurelle entre la distribution des barycentres dans le sondage IFOP 2026 et la dispersion des résultats réels de 2012 — avant la [[Moisation]] macroniste. Les deux présentent la même partition : pôle populaire en bas (Mélenchon/Bardella se disputent l'espace des classes dominées), pôle bourgeois en haut à droite (Philippe/Retailleau dans l'espace Sarkozy, Glucksmann/Hollande dans l'espace Hollande 2012). C'est "un retour à une droite historique. Je vais vous le montrer parce que c'est assez significatif."[^graphique-2012-isomorphisme] La différence : en 2026, le Graphique ne fait grossir que la partie RN de cet espace, sous-estimant l'espace Mélenchon — c'est là que se localise le biais sondagier.

[^graphique-2012-isomorphisme]: [25:13](https://www.youtube.com/watch?v=sk8a235f5Js&t=1513) — "On revient à un espace avant confusion avant le bloc bourgeois macroniste, c'est-à-dire moisé de 2012. [...] comme vous le voyez ça la dispersion ressemble beaucoup au sondage qu'on vous a montré juste avant."

## Observations clés
- L'abstention se déplace: en 2002 elle est centrale/transclasse, en 2027 elle est à droite (retraités, artisans)
- En 2022, la lutte se fait sur la diagonale (lutte des classes), pas horizontale (droite/gauche classique)
- Les Verts sont "toujours haut milieu, toujours au même endroit" — vote de valeurs post-matérialistes
- La [[Moïsation]] décrit la période de consolidation entre 2002 et 2022
- Le Graphique montre que Mélenchon et Le Pen occupent le même espace sociologique (classes populaires) — la [[Conflictualite interne aux classes populaires]] est le clivage central
- L'[[Eclatement du bloc central]] et la [[Moisation]] achevée rendent possible un second tour Mélenchon/Le Pen en 2027

## L'esprit Charlie comme clivage de classe — démonstration Graphomarxisme

Application à l'Ifop sondage sur le droit à la caricature (10e anniversaire de l'attentat, janvier 2025) : la diagonale oui/non est **parallèle** à la diagonale de classe — c'est donc un clivage de classe, non un clivage transclasse. Les partisans de la caricature illimitée sont dans les classes supérieures ; les classes populaires, qui subissent ces caricatures, s'y opposent davantage (38% en moyenne nationale, 53% chez les électeurs FI).

Ce cas introduit une nuance : le clivage peut être *parallèle mais décalé* — ici, décalé vers les vieux. Les classes supérieures retraitées portent le "non" (pro-caricature), les retraités de classes inférieures le "oui". Les deux diagonales sont parallèles mais pas superposées — il y a une composante générationnelle dans le clivage Charlie, sans en faire un [[Clivage generationnel]] pur (qui serait perpendiculaire).

Voir [[CHARLIE HEBDO EST-IL REACTIONNAIRE]] — application complète.

## Racisme économique vs racisme culturel — deux espaces différents

Le Graphique permet de distinguer deux racismes qui ne captent pas les mêmes PCS :
- **Racisme de gestion de la pénurie** (Le Pen) : "les Arabes nous volent notre boulot", "préférence nationale", logique de concurrence sociale. Capte les classes populaires bas-gauche/bas-centre qui sont dans l'urgence matérielle. Le Pen est obligée de rester dans cet espace — donc de donner des gages sociaux (retraite à 60 ans, SMIC, pouvoir d'achat) pour ne pas perdre son électorat populaire
- **Racisme civilisationnel** (Zemmour) : grand remplacement, débat de valeurs, identité de la France. Capte des PCS plus dominantes, plus à l'aise, qui s'intéressent aux questions existentielles plutôt que matérielles

Ces deux racismes sont **structurellement incompatibles** comme stratégie électorale unifiée. Quand [[Valerie Pecresse]] a commencé à parler de grand remplacement, elle s'est exclue du cercle électoral populaire — son score s'est effondré à la "bourgeoisie versaillaise", hors du cercle.

Conséquence stratégique : l'antiracisme est le nerf de la guerre spécifiquement dans l'espace populaire. C'est le seul clivage qui permet de différencier Mélenchon de Le Pen quand ils partagent le même espace de classe. Sans antiracisme, pas de différenciation possible. Mais dans l'espace de Zemmour (dominants), l'antiracisme est moins prioritaire — ces PCS ne sont pas les cibles primaires de Mélenchon.

## Validation externe

[[Frederic Lordon]], dans une interview sur [[Blast]], arrive aux mêmes conclusions que le Graphique sur 2027 sans nommer l'outil. La PaduTeam y voit une confirmation que "l'esprit du temps est là" et que la convergence n'est pas accidentelle. Ils suspectent que Lordon les regarde et a intégré leur analyse.

La prédiction réussie de 2022 a consolidé la légitimité du Graphique. Dès janvier 2022, avant la campagne, [[Chris]] projette Mélenchon à 22% — résultat final : 21,95%. La distribution structurelle rendait ce score quasi-obligatoire. La seule erreur : avoir prévu Pécresse à plus de 5%, ce qui aurait pu suffire à faire qualifier Mélenchon. Conclusion : ce n'est pas Roussel qui a fait perdre Mélenchon (son électorat est trop à droite pour basculer vers LFI) — c'est l'abstention trop forte dans le cercle de concurrence. Les critiques adressées au Graphique (sexisme, racisme, réductionnisme) sont mal posées : genre et race ne sont pas absents du Graphique, ils sont encodés dans les [[Dimensions tierces du Graphique]], lisibles à l'intérieur des ronds (PCS). Ajouter une 3D explicite le rendrait illisible.

## Concepts dérivés
- [[Diagonale de pouvoir]] — la ligne méritocratique du Graphique, au-dessus de laquelle les classes sont révolutionnaires, en dessous réactionnaires
- [[Heterogeneite du salariat]] — ce que le Graphique rend visible : les différences au sein du salariat que la catégorie "99%" masque
- [[Pensee idealiste vs materialiste]] — le Graphique comme outil matérialiste face aux approches idéalistes
- [[Clivage generationnel]] — quand la diagonale oui/non est perpendiculaire à la diagonale de classe, c'est un clivage générationnel ou de mode de production (et non un clivage de classe)

## Vidéos où le concept est développé
- [[COMMENT MELENCHON VA GAGNER EN 2027 AU SECOND TOUR]] — Vidéo fondatrice : démonstration complète du Graphique appliqué à la présidentielle 2027. Trois graphiques mis en regard : 2002 (éparpillement total, abstention centrale transclasse, espace vide bas-gauche), 2022 (consolidation des blocs, diagonale de lutte des classes), 2027 (retour à l'éparpillement à droite, abstention déportée à droite, Mélenchon capte l'abstention populaire et monte vers les cadres). La vidéo introduit les scores chiffrés de la projection (RN 19,8 %, FI 16,86 %, PS 16,18 %, LR 13,67 %, Horizon 10,84 %) et l'abstention à 18 % historiquement basse[^graphique2027vid]

[^graphique2027vid]: [30:28](https://www.youtube.com/watch?v=VFiHhZiOWZ8&t=1828) — "Voilà donc le graphique du futur. Est-ce que vous êtes prêts à voir le futur ? [...] L'abstention en 2027 est à 18 %. Voilà comment gagner. On sort du dooming."
- [[LE GRAPHIQUE EST-IL VRAIMENT SEXISTE]] — Défense du Graphique contre les critiques de sexisme/racisme, explication complète des dimensions tierces, validation de la méthode Google Trends (Mélenchon prédit à ~22%, résultat 21,95% ; Zemmour prédit à 7-8%, annoncé à 18%)
- [[Debunk Graphique Bad Mulch]] — Masterclass pédagogique : réponse à [[Bad Mulch]], explication technique des axes, de la [[Diagonale de pouvoir]], et défense du matérialisme contre la pensée idéaliste
- [[BACKSEAT vs PADUTEAM COMMENT EMPECHER LE RN EN RURALITE]] — Application du Graphique à l'analyse de la ruralité et du vote RN
- [[Faut-il en finir avec le NFP]] — Démonstration la plus complète à ce jour : rubans électoraux 2002-2024 par bloc, zoom intra-bloc (droitisation interne, gauche de rupture vs gauche molle), positionnement de tous les candidats majeurs par PCS avec barycentres, et preuve que le NFP/NUPES déplace le barycentre vers la bourgeoisie
- [[La CARTE DES QI version MARXISTE le GRAPHIQUE de Positions Revue|La CARTE DES QI version MARXISTE]] — Capsule pédagogique de référence : explication complète des deux axes (Marx = exploitation, Bourdieu = domination), distribution de toutes les PCS INSEE, explication de l'algorithme, puis analyse électorale comparative 2017/2022/européennes 2024 par barycentres en composition
- [[Faure oblige de trahir]] — Rappel pédagogique complet (axes, barycentres, composition vs captation), application aux européennes 2024, annonce de développements futurs (dimensions tierces par âge/ville/région, données Piketty, ouverture publique du code, analyses historiques)
- [[Cannabis Rasta Roussel vs Douanier Roussel]] — Nouvelle application : le Graphique distingue clivage de classe (diagonale parallèle) et [[Clivage generationnel]] (diagonale perpendiculaire) sur le cannabis. Roussel est inadéquat sur la question, Mélenchon parfaitement adéquat aux actifs
- [[L'ILLUSION DE VILLEPIN POURQUOI IL NE PEUT PAS GAGNER EN 2027]] — Exercice de prédiction pure : le Graphique projette Villepin à 6-7% max en analysant l'espace de classe élection par élection (2017, 2022, 2024). Nouvelle version interactive présentée. Défense de la prédiction comme base de l'esprit scientifique
- [[GRAPHOMARXISME x Positions Revue]] — voir [[L'ILLUSION DE VILLEPIN POURQUOI IL NE PEUT PAS GAGNER EN 2027]]
- [[Nicolas qui paye]] — Application du Graphique au vote des cadres seuls en 2017 et 2022, montrant la gauchisation (Mélenchon 15%→20%, Fillon/Pécresse 15%→5%) et l'effondrement de la droite dans cette catégorie
- [[Hollande vs Melenchon 2e tour]] — Démonstration magistrale : analyse complète du Graphique 2002 (16 candidats positionnés), explication du concept d'espace sociologique partagé ("même espace = mêmes rapports matériels = mêmes problèmes"), puis projection sur 2027. Le Graphique construit visuellement la prophétie du 2002 inversé
- [[2 MALES TOXIQUES MARXPLIQUENT le GRAPHIQUE|2 MÂLES TOXIQUES MARXPLIQUENT le GRAPHIQUE]] — Capsule pédagogique fondamentale : la PaduTeam explique les deux axes, la [[Diagonale de pouvoir]], les espaces révolutionnaire/réactionnaire, la [[Socialisation des moyens de production]] vs désocialisation néolibérale. Application à la profession médicale. Références bibliographiques complètes (Mallet, Wright, Bihr, Bidet, Amable/Palombarini)
- [[Les INCELS ont ENFIN leur SAINT GRAPHIQUE]] — [[Marc]], YouTubeur masculiniste, a créé son propre tableur d'analyse ("calculateur de la passe maritale"), involontairement parodique du Graphique — d'où le titre de la vidéo
- [[LORDON MELENCHON peut GAGNER en 2027]] — Description technique détaillée du ranking ACM (-10 à +10) ; validation implicite par Lordon
- [[Les LIVREURS-UBER + BOURGEOIS que les MEDECINS]] — Distinction fondamentale entre Graphique et Bourdieu : [[Rapports de production]] vs capitaux cumulés. Application aux artisans, livreurs Uber, médecins, auto-entrepreneurs
- [[L'ALLIANCE MELENCHON-GLUCKSMANN FAUSSE BONNE IDEE]] — "La prophétie du Graphique" confirmée par les sondages agrégés : effondrement du centre (18% → 14%), chute du RN (36% → 29%), montée de la gauche. La [[Moisation]] visible en temps réel
- [[AURORE BERGE FAIT BARRAGE A LFI EN S'ALLIANT AU RN]] — Bergé qualifiée de "marionnette du graphique" : ses mouvements sont exactement ce que le Graphique prédit pour la consolidation du bloc de droite réactionnaire
- [[BOMPARD DETRUIT WAUQUIEZ sur BFMTV]] — Le Graphique prédit la configuration Retailleau/Le Pen/Mélenchon au 1er tour
- [[MELENCHON vs LE PEN 2027 les MEDIAS ENTREVOIENT enfin la PROPHETIE]] — Validation mainstream de la prophétie ; les journalistes convergent vers les conclusions du Graphique sans en saisir la portée ; graphiques 2017 et 2022 montrés pour documenter la sous-estimation systématique du bloc gauche
- [[MORT DE JEAN-MARIE LE PEN - SEPARER L'HOMME DU TORTIONNAIRE FASCISTE]] — Présentation pédagogique de l'outil en fin de vidéo : explication des CSP et comportement politique, exemple "propriétaire de 10 salariés vs travailleur agricole". la PaduTeam qualifie la capsule Graphique/Positions Revue de "peut-être la vidéo la plus importante du mois de janvier"
- [[ONFRAY NAULLEAU ET VALLS DECOUVRENT QU'ILS SONT DE DROITE]] — Application de la distinction "confusion du haut" vs "confusion du bas" pour analyser l'intérêt stratégique (ou non) de délester les faux-gauches de leurs plateaux médiatiques
- [[LE MEDEF PLEURE ET VEUT FAIRE GREVE]] — Portrait de classe de Patrick Martin (président du MEDEF) comme archétype du haut-droite du Graphique : Sciences Po Paris + Assas + école de commerce + officier de réserve. Application directe de l'axe exploitation : "structure d'investissement = structure d'exploitation". Démonstration que le patronat (95% des richesses) est au sommet droit du Graphique — exploiteur et dominant.
- [[CHRIS DEVOILE COMMENT MELENCHON VA GAGNER EN 2027]]
- [[CHARLIE HEBDO EST-IL REACTIONNAIRE]] — Application à un objet culturel : sondage Ifop repondéré ACM, démonstration du clivage de classe parallèle (vs perpendiculaire pour le cannabis), distinction racisme civilisationnel (haut-droite) vs racisme de pénurie (bas-gauche), positionnement de Roussel/Franc-Tireur dans l'espace Charlie
- [[TONDELIER CANDIDATE A LA PRESIDENTIELLE ON ANALYSE LA REINE DES NOISETTES]] — application de la position haut-milieu pour expliquer l'idéalisme maximal de Tondelier : à l'écart de l'inconfort matériel ET à l'écart de la possession des moyens de production ; prédiction 2% par le Graphique — Application du Graphique à la stratégie 2027 : rubans électoraux depuis 2002, positionnement des candidats 2027 par analogie avec 2002, proposition des [[Etats generaux du Graphique]] (assemblée de 5000 tirée au sort selon les PCS) comme horizon démocratique
- [[SONDAGE ANTI-MELENCHON L IFOP MET L EXTREME DROITE A 62 AU 1ER TOUR]] — Démonstration complète du biais sondagier via le Graphique : positionnement des candidats du sondage IFOP 2026, comparaison structurelle avec la dispersion de 2012 (même partitionnement avant [[Moisation]] macroniste), "graphicide" opéré sur les PCS révélées par l'IFOP lui-même (71% de chômeurs pour Bardella = aberration de composition), comparaison visuelle des blocs réels vs sondages depuis 2002. Inclut aussi une explication pédagogique complète des deux axes (Zoé se positionne elle-même : médecin = haut et un peu à droite)
