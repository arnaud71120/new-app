# Revue complète de Cyberveille — 20 octobre 2026

Version examinée : **2026-10-19.6**, commit
[`9a54e24`](https://github.com/arnaud71120/new-app/tree/9a54e240e363de0a546a6e55111e1380f8f8695b).

La priorité est la fiabilité : une connexion durable, une collecte dont on
connaît réellement la fraîcheur, des diagnostics cohérents et des commandes
administratives fiables. L’application possède déjà une base fonctionnelle
riche. Ajouter de nombreux écrans sans consolider ces points rendrait les
incidents plus difficiles à comprendre.

Cette revue livre un état des lieux et un backlog. Les corrections et nouvelles
fonctions ci-dessous **ne sont pas encore implémentées** par cette revue.

## 1. Périmètre et degré de vérification

Examens : routes API, contrôles d’accès, traitement des URL, stockage, collecte
RSS/Atom/JSON et sociale, quotas, traduction/tutorat, fil, cockpit, formations,
administration, scripts de build et workflows GitHub.

- **184 tests existants passent**, construction Worker ESM valide.
- **62 entrées au catalogue initial, dont 58 actives** ; dix profils X et dix
  profils LinkedIn ; douze parcours et quarante-deux leçons.
- Reproductions locales supplémentaires, réseau simulé :
  [`audit/reproductions-2026-10-20.mjs`](../audit/reproductions-2026-10-20.mjs).
- Résultats enregistrés :
  [`audit/resultats-2026-10-20.json`](../audit/resultats-2026-10-20.json).
- Backlog exploitable :
  [`audit/BACKLOG-2026-10-20.csv`](../audit/BACKLOG-2026-10-20.csv).

Les états de production transmis dans la conversation confirment une panne de
lecture JWKS et le recours aux clés embarquées. Ils ont aussi montré une
collecte X réussie avec des contenus anciens. **La fraîcheur après les nouveaux
filtres, le cron effectivement installé, les permissions du compte cloud, les
quotas fournisseur et le rendu mobile actuel ne sont pas validés par cette
revue.** Aucun nouvel appel réel Bright Data ou Gemini n’a été lancé pour elle.
Les tests Node/VM ne remplacent pas une recette Cloudflare Workers et Safari.

## 2. Points déjà solides à préserver

- Signature RSA du JWT Access vérifiée avec audience, émetteur, dates et
  identité ; refus des jetons falsifiés et du simple marqueur navigateur.
- Contrôle d’origine sur les écritures sensibles ; politique CSP avec nonce,
  échappement HTML, restrictions des images et en-têtes de sécurité.
- Coordination persistante des appels IA, baux de collecte et limites de débit.
- Réservations prudentes Bright Data ; refus des relances de démarrages
  incertains et absence de basculement payant automatique.
- Cache, chargement par lots, conservation des articles lors d’un échec,
  actualisation relançable et lecture sociale indépendante.
- Catalogue administrable persistant et contrôle de révision entre onglets.
- Cours de base accessibles sans IA, préparations et laboratoires détaillés,
  copie vers Gemini personnel et animations respectant la réduction de mouvement.
- Tests de sécurité et d’intégration, vérification du build dans GitHub.

Ces mécanismes sont utiles. Une refonte doit conserver leurs garanties et leurs
tests, plutôt que les réécrire en bloc.

## 3. Constats prioritaires

Priorités : **P0** = échéance pouvant interrompre l’accès ; **P1** = fiabilité,
sécurité ou conservation des données à traiter rapidement ; **P2** = amélioration
importante à planifier. « Confirmé » décrit un comportement de code reproduit
ou directement observable ; cela ne signifie pas qu’un incident a été démontré
en production.

### R01 · P0 · Rendre l’accès indépendant du secours JWKS temporaire

**Confirmé par code et diagnostic de production.** Le secours expire le
**26 octobre 2026 à 10:52 UTC**. Si la lecture distante reste impossible, une
nouvelle vérification de session ne pourra plus utiliser ces clés.

À faire : identifier l’erreur réelle depuis le Worker (DNS, transport, contexte
d’exécution, refus HTTP), avec erreurs structurées et identifiant de requête ;
réparer la lecture officielle et prévoir le renouvellement contrôlé des clés.
Ne pas prolonger indéfiniment une copie qui pourrait contenir une clé retirée.

Critère : une session valide affiche `keySource` distant ou une indication
équivalente de validation distante ; rotation et retrait de clé testés ; alerte
avant expiration du secours. Référence : `worker/access-jwks.js:6` et
`worker/index.js:265`.

### R02 · P1 · Faire respecter le véritable arrêt global des appels externes

**Reproduit.** Avec `EXTERNAL_CALLS_PAUSED=true`, `/api/feed?continue=1` effectue
encore **quatre téléchargements** dans le scénario d’audit. La génération IA et
les nouvelles opérations sociales vérifient cet interrupteur, la collecte des
flux et le test individuel de source ne le font pas.

À faire : définir clairement trois commandes — arrêt externe global, pause
RSS, pause des nouveaux lancements sociaux — et appliquer la première à tous
les chemins réseau, y compris tests et vérifications de versions. Préserver la
lecture des caches et documenter le traitement des requêtes déjà parties.

Critère : zéro requête fournisseur après activation de l’arrêt global, dans
les tests de toutes les routes concernées. Références : `worker/index.js:245`,
`worker/index.js:487`, `worker/index.js:528`.

### R03 · P1 · Mesurer les nouveaux posts, les doublons et la fraîcheur

**Reproduit.** Deux lignes identiques donnent `saveArticles() = 2`, mais une
seule publication stockée. `lastCount` mesure les lignes normalisées acceptées,
pas les nouvelles publications uniques. Un résultat « ready » ne prouve donc
ni nouveauté ni fraîcheur.

À faire : distinguer lignes reçues, lignes reconnues, URL uniques, nouveaux
posts, posts déjà connus et rejets ; enregistrer le dernier post reçu pour
chaque profil et un indicateur de retard. Afficher « aucun nouveau post » quand
la collecte renvoie uniquement des doublons. Appliquer aussi une mesure de
fraîcheur aux flux RSS.

Critère : deux occurrences d’un même nouveau post donnent un ajout et un
doublon ; la même collecte relue donne zéro ajout. Référence :
`worker/index.js:486`.

### R04 · P1 · Valider le contrat Bright Data sur de vrais résultats récents

**Vérification de production encore nécessaire.** Les champs `start_date`,
`num_of_posts`, `include_reposts` et `only_authored_posts` sont maintenant envoyés.
Leurs scénarios sont simulés ; ils ne prouvent pas que la découverte réelle
respecte la fenêtre ou expose tous les posts récents.

À faire : conserver la fenêtre demandée, le snapshot, le profil, les dates
min/max reçues et des motifs de rejet précis. Comparer, sur un petit échantillon
autorisé, les résultats avec les pages publiques accessibles. Séparer absence
réelle de publication, profil inaccessible, résultat ancien et erreur d’import.
Ne pas relancer automatiquement une extraction incertaine ou multiplier les
collectes pour masquer une couverture partielle.

Critère : recette documentée pour X et LinkedIn, sans augmentation du plafond
mensuel ; les résultats anciens sont signalés, pas présentés comme une mise à
jour récente. Référence : `worker/index.js:455`, `worker/index.js:487`.

### R05 · P1 · Corriger le filtre des reposts du fournisseur

**Reproduit.** Une ligne X comportant `is_repost: true` est acceptée. Le filtre
local ne vérifie que `isRetweet` et `isRepost`. La requête demande déjà
`include_reposts:false`, mais un paramètre fournisseur ne remplace pas la
validation des résultats.

À faire : normaliser les variantes documentées des champs, tester les citations,
réponses et republications, puis définir explicitement ce que le fil conserve.
Critère : le cas `is_repost:true` est traité conformément au choix produit.
Référence : `worker/index.js:466`.

### R06 · P1 · Canonicaliser les noms d’hôte avant de filtrer les URL

**Reproduit.** `https://localhost./` et `https://service.internal./rss` sont
acceptés par `adminURL()`. Le point DNS final contourne les comparaisons de
suffixe. Aucune exploitation réseau n’a été tentée ; les protections réseau de
Workers peuvent refuser ensuite certaines destinations.

À faire : retirer le point final, normaliser et vérifier à nouveau le nom,
ajouter les cas encodés et les redirections aux tests. Évaluer aussi le
traitement des domaines publics résolvant vers des adresses privées, selon les
garanties effectives du runtime. Ne pas assimiler le filtrage syntaxique à une
preuve de résolution publique.

Critère : ces noms sont refusés avant tout `fetch`, y compris en redirection.
Référence : `worker/admin.js:2`.

### R07 · P1 · Rendre une modification d’administration atomique

**Reproduit avec une panne simulée.** Si l’écriture du journal échoue après celle
de la configuration, l’action renvoie une erreur mais la configuration est déjà
modifiée. Dans le scénario d’audit, `feedsPaused` devient vrai et la révision
passe à 1 malgré l’échec.

À faire : transaction de stockage pour configuration, journal et invalidation,
ou mécanisme explicite de validation/reprise ; identifiant d’action pour rendre
les répétitions idempotentes. Afficher la révision effectivement enregistrée.

Critère : une panne donne soit un changement complètement appliqué, soit aucun
changement ; aucune erreur ambiguë. Référence : `worker/admin.js:45`.

### R08 · P1 · Prévoir les droits avant d’ouvrir l’application à d’autres lecteurs

**Constat de code, risque dépendant de l’audience Access.** L’administration
utilise `authorized()` comme les autres fonctions privées. Il n’existe pas de
rôle lecteur/administrateur distinct. Toute session admise par cette politique
peut donc demander une modification du catalogue. Cela ne démontre pas un accès
public ou non autorisé sur la configuration actuelle.

À faire : une règle administrateur côté serveur — identité/claim ou application
Access séparée —, rôle lecteur par défaut si l’audience est élargie, journal
avec acteur. Le simple masquage du bouton ne suffit pas.

Critère : un lecteur autorisé au fil reçoit 403 sur les écritures admin ; un
administrateur reste autorisé. Références : `worker/index.js:322`,
`worker/index.js:538`.

### R09 · P1 · Recalculer le budget social et prévoir la fin de mois

**Calcul confirmé.** Avec dix profils X, trois posts toutes les six heures et
dix profils LinkedIn à un post par jour, un mois de 31 jours prévoit
**4 030 résultats réservés**, pour un plafond applicatif de **4 000**.
Le blocage du dépassement est utile ; le calendrier ne peut simplement pas être
servi entièrement à ces paramètres dans le cas maximal.

À faire : prévision mensuelle, reste disponible, estimation des prochaines
collectes et rotation/priorisation des profils dans le plafond. Distinguer
réservation locale, résultat reçu et consommation fournisseur constatée.
Critère : un calendrier de 28/29/30/31 jours reste dans 4 000 sans interruption
surprise ni modification payante. Référence : `worker/index.js:487`.

### R10 · P1 · Préserver réellement les favoris

**Constat de code.** Les favoris ne conservent que des identifiants dans le
navigateur. La vue « À lire plus tard » filtre les événements actuellement
chargés. Une publication sortie des flux ou du stockage n’est donc plus
consultable depuis cette vue, même si son identifiant reste marqué.

À faire : conserver au moins titre, lien, source, date et extrait avec le favori ;
prévoir export et suppression ; synchronisation privée facultative entre
appareils. Critère : un favori reste visible après disparition du fil et après
rechargement. Références : `worker/index.js:603`, `worker/index.js:678`.

## 4. Améliorations structurelles et de qualité

| ID | Priorité | Constat et évolution souhaitée | Vérification attendue |
|---|---|---|---|
| R11 | P1 | Pas de journal durable de chaque exécution : seulement derniers états/tests et journal des modifications. Ajouter identifiant de collecte, étapes, durées, erreurs normalisées, historique borné et export diagnostic expurgé. | Reconstituer une panne passée depuis l’administration sans ouvrir le code. |
| R12 | P2 | Le cron actuel appelle la collecte sociale ; les flux RSS dépendent de l’ouverture/actualisation. Proposer une collecte RSS planifiée, avec file et budget, si une veille site fermé est souhaitée. | Les sources à échéance avancent site fermé, dans les quotas Workers. |
| R13 | P2 | Une seule page NVD de vingt résultats est demandée ; le parseur n’utilise que CVSS v3.0/v3.1. L’échantillon fictif critique uniquement v4 est ignoré. Ajouter pagination bornée et prise en charge CVSS v4. | Jeu couvrant plusieurs pages, plusieurs versions de score et dates ; couverture affichée honnêtement. |
| R14 | P2 | Écran initial : **939 902 octets HTML**, dont **898 716 octets de script** ; estimation gzip locale ~159 Ko, pas une mesure réseau de production. Les cours/catalogues sont tous embarqués. Charger les gros catalogues et cours à la demande, utiliser des assets versionnés cachables et paginer le fil. | Mesures avant/après sur mobile ; aucune régression hors ligne/formation annoncée. |
| R15 | P2 | `worker/index.js` fait ~584 Ko, avec données, API, sécurité et UI. Le build assemble des modules par remplacement de chaînes. Extraire progressivement les domaines et utiliser un assemblage explicite vérifiable. | API et parcours identiques, tests préservés, modules chargeables sans substitutions fragiles. |
| R16 | P2 | Les tests VM sont utiles mais ne reproduisent pas entièrement Workers, Durable Objects, cron, annulation et Safari. Ajouter une recette runtime Workers locale/préproduction et quelques parcours navigateur. | Connexion, collecte, actualisation, création de source, quota et restauration testés de bout en bout. |
| R17 | P2 | Export de configuration sans import/restauration complet ; suppression d’une source personnalisée sans corbeille et sans son ancienne URL dans le journal. Ajouter sauvegarde versionnée, restauration validée et corbeille. | Export/import aller-retour et retour arrière d’une modification erronée testés. |
| R18 | P2 | Le nettoyage de sécurité liste au maximum mille clés par passage, sans pagination. Une population supérieure peut laisser des clés en fin d’ordre non parcourues. Paginer, mesurer les volumes et séparer les préfixes. | Plus de mille entrées simulées ; toutes les entrées expirées finissent supprimées. |
| R19 | P2 | Le stockage social s’arrête à 800 posts ou 60 jours : 800 peut être atteint en environ six jours à 130 posts/jour. Afficher la rétention effective et dissocier archive et fil récent. | La capacité et la politique d’effacement sont visibles ; l’utilisateur peut exporter avant purge. |
| R20 | P2 | `nextAt`/`nextAttemptAt`, intervalle et pause n’expriment pas encore un planificateur unifié ; une échéance passée n’indique pas la cause d’un retard. Centraliser les états « prévu, éligible, en file, en cours, différé, suspendu ». | Même prochaine échéance et même motif dans le fil, l’admin et le diagnostic. |

## 5. Expérience utilisateur et mobile

Le comportement mobile doit être validé sur Safari iPhone et Chrome Android,
avec connexion lente, reprise de réseau et retour après mise en arrière-plan.
Les captures précédentes ne valident pas tous les changements récents.

Améliorations à forte valeur :

1. **Un statut de veille compact** : dernière collecte, dernier nouveau post,
   nombre de nouvelles informations, retard éventuel, prochain passage et motif
   de pause. Relier le message d’erreur directement à la bonne fiche diagnostic.
2. **Des actions non ambiguës** : « Relire le fil », « Vérifier les collectes »,
   « Tester une source ». Une relance d’extraction doit indiquer l’éligibilité
   et la réservation prévue ; aucun déblocage aveugle d’un démarrage incertain.
3. **Filtres mémorisés et liens partageables** : source, thème, période,
   non-lus, importance ; URL permettant de revenir à une leçon ou un dossier.
4. **Dossiers lisibles** : résumé, faits rapportés, sources indépendantes,
   chronologie et liens originaux ; éviter une longue liste de contenus redondants.
5. **Administration sur téléphone** : commandes principales toujours visibles,
   erreurs de formulaire proches du champ, brouillon conservé en cas de conflit,
   indication claire de la révision enregistrée et retour arrière possible.
6. **Accessibilité vérifiée** : il existe déjà labels ARIA, boîtes de dialogue
   natives et réduction de mouvement. Compléter par tests VoiceOver, clavier,
   zoom et contraste ; vérifier notamment les contrôles natifs Safari et la
   restitution du focus pendant les reconstructions du DOM. Aucun défaut de
   contraste mesuré n’est affirmé ici.

## 6. IA, qualité éditoriale et formations

### Traduction et analyses

- Mode à la demande ou priorité aux informations visibles pour maîtriser le
  quota ; détection du français améliorée et cache partagé avant tout appel.
- Budget par usage : traduction, explication, formation ; garder une réserve
  pour une demande utilisateur. Afficher consommation applicative, pauses et
  quota réellement connu, sans présenter une estimation comme un quota Google.
- Enrichissement résumé progressif : texte original toujours lisible, puis
  traduction et analyse séparées. Une erreur IA ne doit pas ressembler à une
  panne de collecte.
- Jeu d’évaluation des traductions : noms de produit, commandes, CVE, négations,
  chiffres et liens conservés. Citations structurées et texte à l’origine de
  chaque affirmation importante.
- Score fondé sur des critères explicites : exploitation connue KEV, criticité,
  périmètre concerné, date et confiance. Les mots « critique » dans un commentaire
  ne suffisent pas à évaluer le risque technique.
- Conserver le mode gratuit confirmé et la copie vers Gemini personnel ; un
  abonnement Pro n’équivaut toujours pas au quota de l’API.

### Parcours d’apprentissage

- Date et version de révision par leçon, niveau réellement testé et compatibilités.
- Progression par compétence avec quiz et exercices de validation, distincte
  de la simple case « acquis ».
- Sauvegarde/export et synchronisation privée facultative de la progression.
- Espace de notes, fiches de révision, reprise de la dernière séance et lien
  entre un article récent et la notion de cours correspondante.
- Vérification programmée des liens officiels, versions des outils et ressources
  de laboratoire ; ne pas exécuter automatiquement les outils ou commandes.

## 7. Fonctionnalités à ajouter, classées par valeur

| ID | Ajout | Valeur pour l’utilisateur | Effort relatif | Conditions |
|---|---|---|---|---|
| F01 | Centre d’incidents et journal des collectes | Comprendre immédiatement où et quand une collecte s’est arrêtée. | Moyen | R11, erreurs expurgées, rétention bornée. |
| F02 | Alertes de fraîcheur et de panne | Savoir qu’une source n’avance plus avant de le découvrir dans le fil. | Moyen | R03 ; canaux choisis et explicitement activés par l’utilisateur. |
| F03 | Liste de surveillance CVE, produits, éditeurs et mots-clés | Faire remonter les informations qui concernent réellement son environnement. | Moyen | Préférences privées ; correspondances expliquées. |
| F04 | Lecture non-lue, favoris durables, notes et tags personnels | Retrouver et exploiter une information plusieurs jours après. | Moyen | R10 ; sauvegarde et effacement. |
| F05 | Briefing quotidien exportable | Un bilan court des nouveautés, pannes et urgences à examiner. | Moyen | Contenu traçable ; génération locale possible, IA facultative. |
| F06 | Import OPML et JSON de sources | Migrer un catalogue existant et restaurer un export. | Moyen | Prévisualisation des changements, validation et contrôle de doublons. |
| F07 | Gestion des profils suivis X/LinkedIn | Ajouter, désactiver ou prioriser les comptes sans modifier le code. | Moyen/fort | Recalcul R09 avant enregistrement ; aucune hausse cachée du coût. |
| F08 | Sauvegardes et corbeille | Restaurer une mauvaise modification ou une source personnalisée supprimée. | Moyen | R07/R17 ; tests réels de restauration. |
| F09 | Dossiers d’événement avec chronologie et provenance | Relier les évolutions d’un incident sans confondre copies et confirmations. | Fort | Identifiants durables et regroupement prudent. |
| F10 | Tableau de couverture des sources/profils | Voir ce qui est effectivement lu, partiel, inaccessible ou trop ancien. | Moyen | Observations par profil, pas seulement par plateforme. |
| F11 | Mode lecture mobile et cache hors ligne choisi | Consulter ses favoris et cours téléchargés en déplacement. | Moyen/fort | Validation de la confidentialité et de la déconnexion avant cache privé. |
| F12 | Synchronisation personnelle entre appareils | Retrouver favoris, notes et progression sur ordinateur et téléphone. | Fort | Identité utilisateur, séparation des données et export. |
| F13 | Rôles lecteur/éditeur/admin et audit avec acteur | Partager la veille sans partager tous les pouvoirs de gestion. | Moyen/fort | R08, contrôle exclusivement côté serveur. |
| F14 | Environnement de préproduction et retour de version | Valider une correction sur un espace séparé avant de modifier la production. | Moyen | Secrets et données isolés, vérification de déploiement, procédure de retour. |

Les efforts sont relatifs, pas des engagements de délai. Les alertes par mail,
message ou autre service restent des fonctionnalités à concevoir avec leurs
permissions ; cette revue n’en configure ni n’en envoie.

## 8. Feuille de route recommandée

### Lot A — Accès et commandes fiables

R01, R02, R06, R07. Décider R08 avant tout partage élargi.

Livrable : lecture JWKS durable, arrêt global effectif, validation d’URL
canonique, écritures atomiques et tests ciblés. Critère de sortie : ces cas de
panne ne nécessitent plus de manipulation manuelle ambiguë.

### Lot B — Collecte mesurable

R03, R04, R05, R09, R11, R20, puis F01/F10.

Livrable : comptage nouveau/doublon/rejet, mesure par profil, journal des
exécutions et prévision de quota. Critère de sortie : pouvoir expliquer un fil
ancien à partir du backend et vérifier un passage réel récent.

### Lot C — Usage quotidien

R10, R14, R17, F03/F04/F05/F06/F08.

Livrable : favoris durables, suivi ciblé, catalogue restaurable et chargement
mobile allégé. Critère de sortie : retrouver ses informations après changement
de fil et restaurer une configuration exportée.

### Lot D — Exploitation et extension

R12/R13/R15/R16/R18/R19, F07/F09/F12/F13/F14 selon les usages retenus.

Livrable : collecte éventuellement autonome, qualité et couverture documentées,
architecture modulaire, préproduction et données personnelles synchronisées si
souhaité. Les évolutions IA/formation s’appuient ensuite sur cette base.

## 9. Recette de production à prévoir

- Confirmer la version déployée et l’accès privé ; renouvellement/retrait JWKS.
- Contrôler les crons installés et les alarmes, site fermé puis ouvert.
- Vérifier un passage X et LinkedIn : paramètres, snapshot, dates, nouveaux
  posts et quota ; tester les profils qui ne renvoient aucun contenu public.
- Tester 403, 404, 429, timeout et réponse HTML sur une source de recette,
  sans consommer les extractions sociales.
- Tester conflit d’administration, panne de stockage et restauration.
- Parcours iPhone/Android : connexion, actualisation relancée, retour d’arrière-plan,
  ajout/modification d’une source, filtres, favori et cours.
- Vérifier un refus de quota Gemini sans masquer les articles ni perdre les notes.
- Mesurer volumes, délais p50/p95 et taille transférée réels ; comparer au budget
  Workers et à la politique de rétention.

Cette recette complétera la preuve locale ; la réussite des 184 tests seule ne
certifie ni les services tiers, ni la configuration cloud, ni la conformité
accessibilité du rendu de production.
