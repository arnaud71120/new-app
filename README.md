# Correction du blocage des flux — version 2026-10-16.25

Les réponses HTTP refusées sont désormais fermées pour libérer les connexions Cloudflare. Le chargement affiche d’abord le cache, puis chaque lot de quatre sources au fur et à mesure, avec des délais bornés. Les articles restent visibles si un lot ultérieur échoue et Actualiser redevient disponible.

135 tests, build et recette navigateur validés. Une collecte réelle du premier lot a retourné 54 informations en environ 1,5 seconde depuis l’environnement de développement. Voir [le défaut reproduit, les corrections et leurs limites](docs/CORRECTIF-COLLECTE-2026-10-16.md).

---

# Préparation des formations — version 2026-10-16.24

33 guides d’installation et de première utilisation sont associés aux 30 leçons et aux 10 parcours : liens officiels, choix du système, vérifications, dépannage, images mémoire/disque, PCAP, ISO et machines virtuelles. Les services Web optionnels sont distingués des logiciels à installer. Les préparations de la leçon sont incluses dans le contexte Gemini et sa copie manuelle.

Les guides sont utilisables sans IA. Les volets restent ouverts lors des actualisations et les blocs de commandes sont lisibles dans le thème sombre. Voir [la préparation et la validation](docs/PREPARATION-DES-FORMATIONS.md).

---

# Connexion et collecte automatiques — version 2026-10-16.23

Cloudflare Access ouvre maintenant automatiquement les fonctions privées. Le code personnel et le bouton d’activation de la collecte sont retirés de l’interface. À l’ouverture, la collecte vérifie les passages arrivés à échéance ; les horaires, les limites gratuites et le planificateur existant sont conservés. La signature et l’audience du JWT Cloudflare sont vérifiées côté serveur.

126 tests et build valides. Voir [le fonctionnement et la validation](docs/CONNEXION-AUTOMATIQUE.md).

---

# Cockpit de veille — version 2026-10-16.22

Nouvel écran d’accueil interactif : activité quotidienne, priorités, sujets, sources, briefing et état de collecte. Fenêtre de 7 ou 30 jours, exploration des articles par clic. Interface sombre et navigation mobile à cinq rubriques. Les graphiques sont calculés localement à partir du fil chargé.

Les échecs réseau conservent le dernier fil et les lots déjà reçus. Les analyses, la provenance et les rapprochements utilisent la collecte en cache. Les erreurs Gemini restent lisibles ; un dossier complet peut être copié vers le compte Gemini personnel sans appel API. Aucun changement de secret, de facturation, de stockage ou de catalogue.

Recette : 123 tests, build et navigation Chromium à 1440 et 390 px. Voir [la revue complète, les corrections et les limites](docs/REVUE-APPLICATION-2026-10-16.md).

---

# Menu Tutoriels — version 2026-10-15.6

Un menu dédié propose six parcours progressifs : OSINT, forensic, pentest, défense, sécurité réseau et Google dorks. Chaque parcours comprend trois leçons (débutant, intermédiaire, avancé), soit 18 leçons originales rédigées en français avec objectifs, prérequis, notions, exercice en quatre étapes, résultat attendu, erreur fréquente, question de compréhension, corrigé et documentation officielle. Les durées sont indicatives ; la progression est déclarative et stockée dans localStorage sur l’appareil. Pas de compte ou de certificat de formation.

Les leçons fondamentales fonctionnent sans IA ni paiement. Les pratiques utilisent un laboratoire autorisé, des données fictives ou des documents publics institutionnels. Le catalogue ne cherche pas de secrets, ne vise pas de personnes privées et n’exécute aucun outil sur des cibles depuis le navigateur.

Chaque parcours affiche les dernières publications correspondantes des flux disponibles, triées par date. Les titres internationaux attendent leur traduction française plutôt que de s’afficher en anglais ; la traduction automatique existante nécessite le déverrouillage et Gemini gratuit confirmé. Les sources externes restent dans leur langue originale. Les documents récents sont des compléments, pas automatiquement des cours relus ou des méthodes éprouvées.

Un catalogue d’outils (Volatility 3, Autopsy, Zeek, Suricata, Sigma, Wazuh, ZAP, Amass, SpiderFoot) vérifie la dernière release publiée sur les dépôts officiels GitHub, avec date de publication, date de vérification et cache d’une heure. Une requête bloquée ou l’absence de release produit « version non vérifiée » ; aucune version n’est inventée. Ce catalogue n’est pas un inventaire exhaustif des outils nouvellement créés, et les versions affichées ne garantissent pas leur adéquation au poste de l’utilisateur.

Le bouton **Approfondir avec les sources récentes · Gemini** ajoute un cours détaillé en français à partir de la leçon, des documentations publiques accessibles, des métadonnées de versions et de trois articles récents correspondants. Il nécessite APP_ACCESS_TOKEN et GEMINI_FREE_TIER_CONFIRMED=true. Aucun basculement vers un fournisseur payant. La disponibilité du fournisseur et ses quotas limitent l’enrichissement ; le cours de base reste accessible en cas d’erreur. Les sorties du modèle ne constituent pas une validation technique des sources et les informations non documentées doivent rester signalées.

Les cours ouverts et enrichissements en mémoire de l’onglet sont préservés quand les traductions ou le suivi social actualisent la page. La progression « acquis » est conservée sur l’appareil ; les cours enrichis ne sont pas conservés après rechargement.

Validation : 41 tests simulés passent et l’artefact ESM est valide. Les tests couvrent la structure et progression des parcours, la présence du menu, les protections de l’enrichissement et l’indication d’outils dont la version est indisponible. Les lectures réelles GitHub, les générations Gemini et le rendu mobile restent à vérifier après déploiement.

Documentation de référence :
- https://bellingcat.gitbook.io/toolkit
- https://volatility3.readthedocs.io/en/stable/
- https://portswigger.net/web-security/learning-paths
- https://sigmahq.io/docs/
- https://docs.zeek.org/en/current/
- https://support.google.com/websearch/answer/2466433

---

# Suivi des collectes — version 2026-10-15.5

Le statut starting indique seulement qu’un identifiant de snapshot a été reçu. Il ne garantit ni résultat ni absence d’erreur finale. Les états sont maintenant affichés en français et accompagnés du nombre de lignes reçues et de publications importées. Le message de suivi est aussi présent sur le fil, avec des filtres X / Twitter et LinkedIn.

Les lectures authentifiées de `/api/social` vérifient désormais les collectes déjà en attente, sans démarrer de nouvelles extractions. Les vérifications sont espacées d’au moins 15 secondes côté stockage et renouvelées toutes les 20 secondes dans l’onglet, en complément des alarmes serveur. Après 10 minutes, un message demande de vérifier le fournisseur. Un snapshot prêt dont le fichier est encore en construction reste en attente au lieu d’être perdu. Les liens LinkedIn régionaux et le champ `use_url` des résultats fournisseur sont reconnus pour l’attribution aux comptes suivis.

38 tests et build valides, dont import sur interrogation, absence de nouveau lancement, fichier en préparation et reconnaissance des domaines LinkedIn régionaux. Vérification du fournisseur réel toujours nécessaire ; aucune publication fictive ajoutée pour masquer une collecte vide.

---

# Cyberveille — mode sans dépense (2026-10-15.3)

Application française de veille cyber pour Cloudflare Workers, sources dans le dépôt privé arnaud71120/new-app. JavaScript ESM sans dépendance. `npm start` pour le développement Node ; `node scripts/test.mjs` pour les tests ; `npm run build` pour l’artefact Worker.

## Choix économique

Bright Data est le seul collecteur social automatique. Apify et l’API X officielle ne sont pas appelés. OpenAI est désactivé dans les routes de l’application même si son secret est présent. La présence d’un secret n’autorise pas de dépenses.

Bright Data annonce 5 000 résultats gratuits par mois et 1,50 $/1 000 résultats au-delà (tarifs à vérifier au moment de l’inscription). La limite de l’application n’est pas une garantie commerciale du fournisseur : elle réserve conservativement au maximum 4 000 résultats par mois. Il faut un compte gratuit **sans carte de paiement, sans fonds prépayés et sans recharge automatique**, et vérifier l’allocation dans la console. Les autres usages du compte partagent potentiellement cette allocation. Ne pas ajouter de fonds pour débloquer une erreur si l’objectif reste 0 €.

- X : les 10 comptes fournis, toutes les 6 heures, maximum 3 publications par profil et passage (30 résultats réservés).
- LinkedIn : les 9 profils fournis, toutes les 24 heures, maximum 1 publication par profil (9 résultats réservés).
- Première collecte : fenêtre d’un jour ; ensuite date du dernier succès avec une heure de recouvrement. Pas d’historique exhaustif.
- Une limite aussi basse peut manquer des publications. Jusqu’à 3 999 résultats réservés sur un mois de 31 jours avec ces intervalles. Pas de relance forcée payante ; les échecs continuent à consommer la réservation prudente.
- Dépassement du nombre demandé dans les résultats fournisseur : blocage des prochains lancements et message de diagnostic. Quota mensuel épuisé : arrêt. Démarrage incertain : pas de nouvelle tentative automatique pour éviter les doublons facturables ; contrôler la console fournisseur.

## Configuration Cloudflare depuis le téléphone

1. Créer un compte gratuit sur https://brightdata.com/products/web-scraper ; vérifier que les 5 000 crédits gratuits sont disponibles, aucun fonds et aucune recharge automatique.
2. Créer/copier un jeton API depuis le tableau de bord Bright Data. Ne pas le transmettre dans ChatGPT ou GitHub.
3. Dans Cloudflare → cyberveille-fr → Settings → **Runtime variables and secrets → Production**, ajouter :
   - `BRIGHTDATA_TOKEN` : **Secret**, le jeton du fournisseur.
   - `BRIGHTDATA_FREE_ONLY_CONFIRMED` : **Variable/Text**, valeur `true`, seulement après la vérification du compte ci-dessus.
4. Le code déclare un Durable Object SQLite `SOCIAL_STORE`, une migration `social-v1` et un déclencheur toutes les 15 minutes dans `wrangler.jsonc`. Cloudflare les installe au déploiement avec Wrangler si les permissions et le plan le permettent. Aucun achat de stockage ni changement de plan automatique. Sur Workers Free, vérifier les quotas gratuits de Durable Objects. En cas de refus, lire le journal du déploiement avant toute modification d’abonnement.
5. Dans Cyberveille → Sources, saisir le code `APP_ACCESS_TOKEN` (Secret Cloudflare existant, 24 caractères minimum), puis cliquer **Activer / vérifier la collecte gratuite**. Sans jeton et confirmation, aucun lancement. Les tâches sont asynchrones : le résultat apparaît après la collecte/polling ; les erreurs restent visibles.
6. Vérifier `/api/status` : version `2026-10-15.3`, `brightdata: true`, `socialStorage: true`. Ce diagnostic constate une configuration, pas une lecture fournisseur réussie.

Aucun mot de passe, cookie ou session X/LinkedIn n’est demandé. Seules les publications publiques sont visées. Les collecteurs restent dépendants des changements de format et des accès autorisés. Les droits de lecture/réaffichage ne sont pas conférés par l’existence d’un abonnement au fournisseur.

## Traduction et explications sans paiement

La clé Gemini seule ne suffit plus à lancer des appels. Dans Google AI Studio, vérifier que le projet associé à la clé dispose du niveau gratuit et **n’a pas de facturation activée**. Ensuite seulement, ajouter `GEMINI_FREE_TIER_CONFIRMED=true` (Variable/Text) dans Runtime. Si le compte/projet gratuit n’est pas disponible, laisser la variable absente : les traductions et analyses restent suspendues, le fil et les références restent consultables. Un appel peut consommer du quota gratuit ; aucun passage automatique à OpenAI ou à une offre payante.

Après déverrouillage, tous les titres/résumés internationaux se traduisent automatiquement par lots. Gemini est le seul choix actif en mode sans dépense ; les originaux restent disponibles par liens. Les analyses techniques détaillées (jusqu’à 6 000 tokens de sortie) restent déclenchées par l’utilisateur et expliquent mécanismes, prérequis, exemples de laboratoire, détection, remédiation et glossaire. Les erreurs de quota suspendent la traduction sans appels répétés payants. Les secrets restent sur le serveur et le code d’accès uniquement en mémoire de l’onglet.

## Stockage et recoupement

Les publications sociales normalisées sont conservées dans un Durable Object SQLite, dédoublonnées par URL canonique et limitées à 800 publications/60 jours. Les intervalles, lancements en attente et réservations mensuelles persistent après redémarrage. Les routes de lecture sociale et d’enrichissement exigent le code privé ; le flux RSS public n’expose pas ce stockage.

Le recoupement examine les dossiers des 25 flux publics configurés et les publications sociales sauvegardées. Même CVE ou lien documentaire : rapprochement explicite. Plusieurs termes de titre communs avec dates proches : candidat incertain. Il ne s’agit pas d’une recherche exhaustive de tout le Web ni d’une validation indépendante de chaque déclaration. Les articles d’une même CVE sont déjà regroupés dans leur fiche.

Bouton **Chercher dans toutes les sources collectées** : affiche le nombre de dossiers examinés, les liens et les raisons du rapprochement. Les explications IA reçoivent aussi jusqu’à trois articles candidats, identifiés comme tels. La provenance lit jusqu’à trois publications et deux références amont sur des domaines autorisés ; elle signale les documents inaccessibles. Les plateformes de fuite mentionnées restent attribuées à la publication qui les rapporte, sans téléchargement de dumps, sans accès privé et sans prétendre connaître l’emplacement réel des fichiers.

Les 25 flux couvrent CERT-FR, ZATAZ, IT-Connect, BleepingComputer, The Hacker News, SecurityWeek, Krebs, The Record, Schneier, SANS ISC, Talos, Securelist, ESET, Sophos, Microsoft, Project Zero, CISA, NCSC UK, JPCERT, PortSwigger, DFIR Report, Black Hills, SpecterOps, Bellingcat et OWASP. État de collecte affiché indépendamment pour chaque source.

## Limites et vérification

33 tests simulés : normalisation Bright Data, attribution, stockage persistant, budget mensuel, refus des relances incertaines, blocage API X/Apify, absence de lancement sans confirmation gratuite, provenance, traduction et génération. Build ESM vérifié. Les véritables collectes Bright Data et la migration Cloudflare ne peuvent être validées sans configuration et exécution sur le compte du propriétaire. Les schémas des collecteurs peuvent évoluer : les erreurs de validation sont remontées, sans achat ni changement de fournisseur automatique.

Configuration d’extraction préparée : `/datasets/v3/trigger`, snapshots et polling ; datasets X `gd_lwxkxvnf1cynvib9co`, LinkedIn `gd_lyy3tktm25m4avu764`, découverte par `profile_url`, limite par entrée. Si la console Bright Data propose une autre méthode de découverte pour X, comparer le schéma du playground et ajuster avant de relancer ; les pages de documentation X redirigent actuellement certaines anciennes routes vers la collecte par URL de publication.

Références :
- https://brightdata.com/products/web-scraper/twitter
- https://brightdata.com/products/web-scraper
- https://docs.brightdata.com/api-reference/scrapers/social-media-apis/linkedin-posts-discover-by-profile-url
- https://developers.cloudflare.com/durable-objects/platform/pricing/

## Correctif 2026-10-15.4 : requêtes refusées HTTP 400

Les requêtes de lancement sont réduites au schéma minimal des profils (`url` uniquement), avec maintien des plafonds `limit_per_input` côté requête. Les champs optionnels de date et les paramètres propres aux collecteurs sont retirés pour éviter les incompatibilités de validation. La collecte peut donc relire des publications anciennes, toujours dédoublonnées au stockage mais susceptibles de consommer l’enveloppe gratuite. Aucun élargissement du plafond.

Les motifs Bright Data de refus sont affichés dans le diagnostic après masquage des secrets. Un HTTP 400 libère la réservation locale correspondante ; les réservations des refus de l’ancienne version sont libérées une fois lors de la migration du format. Les démarrages incertains restent bloqués, sans relance automatique. Le bouton manuel permet de réessayer une requête refusée après une minute ; il ne relance pas une collecte en cours ou déjà réussie avant son intervalle.

35 tests simulés et build passent. L’erreur exacte et le succès réel du fournisseur restent à vérifier sur l’hébergement ; aucun appel ne peut être testé avec les secrets de production depuis le dépôt.

### Mise à jour 2026-10-15.8 : cours pratiques et configuration

Les 18 leçons incluent maintenant un laboratoire autonome en français : préparation,
fonctionnement, manipulations ou commandes, observations attendues, interprétation,
dépannage et exercice corrigé. Les outils s’exécutent sur le poste de l’apprenant ;
la page ne les exécute pas. Les versions et sorties peuvent varier selon la plateforme.
Aucune clé IA n’est nécessaire pour ces leçons intégrées.

Dans Cloudflare, sélectionner le Worker → Settings → Runtime variables and secrets
→ Production, et non les variables de Builds. `GEMINI_API_KEY` est un Secret ;
`GEMINI_FREE_TIER_CONFIRMED=true` est une variable Text attestant que le projet
Gemini est sans facturation. `BRIGHTDATA_TOKEN` est un Secret ;
`BRIGHTDATA_FREE_ONLY_CONFIRMED=true` est une variable Text attestant la vérification
du compte Bright Data sans fonds ni recharge automatique. Enregistrer et déployer,
puis recharger Cyberveille et déverrouiller les connexions avec APP_ACCESS_TOKEN.
Ces confirmations ne vérifient pas automatiquement les comptes des fournisseurs.

Les diagnostics sociaux distinguent lignes reçues, publications reconnues et erreurs
fournisseur, en masquant les jetons connus. Les réponses LinkedIn imbriquées dans
`posts` sont acceptées tout en conservant la priorité de l’auteur explicite du post.
Une activation manuelle peut relire une fois un snapshot déjà enregistré après une
mise à jour de l’importeur, sans nouveau déclenchement ni réservation d’extraction.
Les anciennes collectes dont l’identifiant n’a pas été conservé nécessitent une
vérification du résultat directement dans la console Bright Data.

### 2026-10-15.9 : Gemini seul, tutorat et session explicite

Le fournisseur IA de l’application est uniquement Gemini ; les clés d’un autre
fournisseur sont ignorées. Google AI Pro dans l’application Gemini et les appels
programmatiques Gemini API ont des modalités et quotas distincts : aucun abonnement
n’autorise automatiquement des appels API payants. Le mode sans dépense demeure.

Chaque exercice inclut une explication technique et un dialogue contextuel avec
Gemini via `/api/course-chat` (code privé, origine même site, tailles bornées,
historique limité, garde de concurrence et temporisation). Rien n’est exécuté.
Le dialogue reste dans la mémoire de la page. « Copier pour Gemini » prépare le
cours et la question dans le presse-papiers ; l’utilisateur peut les coller dans
l’application Gemini avec son compte Pro. Aucun transfert automatique à l’app
Gemini et aucune utilisation de cookies ou de la session Google.

Le code personnel est vérifié via `/api/session` avant d’annoncer une connexion.
Après validation, sessionStorage le conserve pour les rechargements dans cet onglet.
Le navigateur peut restaurer une session d’onglet ; utiliser « Verrouiller » pour
supprimer le code. Aucun stockage dans localStorage. La restauration revalide le
code puis charge les publications sociales enregistrées. Une collecte Bright Data
vide ou non reconnue ne devient pas artificiellement une publication.

### 2026-10-15.10 : tableau des feux de diagnostic

Dans Sources, un tableau privé affiche les états vert (lecture ou réponse vérifiée),
orange (configuration seule, collecte en cours, ancien résultat ou aucun post),
rouge (configuration manquante ou erreur). Il couvre Gemini, Bright Data, stockage,
X, LinkedIn, chaque profil suivi sur chaque plateforme et chaque flux RSS.
Les erreurs RSS conservent leur code HTTP. Les conseils expliquent les erreurs
400/401/402/403/404/429/5xx, délais, réponses vides et paramètres manquants.

`GET /api/health` exige le code personnel et ne déclenche ni extraction sociale
ni appel Gemini. Il peut lire les flux RSS avec le cache habituel de 60 secondes.
`POST /api/health/gemini` exige aussi la même origine et un projet gratuit confirmé ;
le clic effectue un test court, limité à un par minute et sans concurrence IA.
Le résultat Gemini est un dernier état observé pendant au plus une heure dans cette
instance du Worker, pas une garantie permanente ni un test de tous les usages.
Les paramètres secrets se modifient dans Cloudflare ; aucun éditeur de secrets ou
API de modification de la configuration n’est exposé dans l’application.

### 2026-10-15.11 : lisibilité et causes communes

Les cartes de diagnostic utilisent une classe dédiée en affichage vertical :
l’ancien flex horizontal des cartes du catalogue ne doit pas s’y appliquer.
Les longs noms de paramètres et liens reviennent à la ligne. La vérification
visuelle Chromium n’a pas pu être exécutée dans cet environnement (socket Crashpad
refusé) ; la génération HTML/JS et les règles dédiées sont vérifiées par les tests.

Les confirmations manquantes sont regroupées avec le nom et la valeur à saisir
séparément dans les variables runtime Production. Les profils dépendant d’une
plateforme bloquée passent en orange et sont regroupés dans une section dépliable.
Les anciennes entrées désactivées des API X/LinkedIn ne sont plus dupliquées dans
les diagnostics. Le résumé du fil distingue publications conservées et nouvelles
collectes bloquées. Les conseils RSS n’évoquent plus de modèle ou de clé API.

Project Zero utilise https://projectzero.google/feed.xml ; SpecterOps utilise
https://specterops.io/feed/. L’ancienne URL OWASP /feed.xml répondant 404, OWASP
reste une référence manuelle et pédagogique, sans annoncer un flux actif.
Les 403 côté fournisseur ne sont pas contournés et restent signalés.

Après correction de la configuration, « Réessayer LinkedIn uniquement » peut
relancer une collecte antérieure vide, au plus une fois par heure, sans relancer X.
Le compte Bright Data sans fonds confirmé et le plafond mensuel restent obligatoires.
La route ciblée ne crée jamais une seconde collecte si un job est en cours.
La relance réserve au maximum 9 résultats et ne garantit pas leur disponibilité.

### 2026-10-15.12 : conserver la configuration lors des builds

Les deux confirmations que le propriétaire a déjà renseignées sont désormais
déclarées comme chaînes dans `wrangler.jsonc` sous `vars` :
`GEMINI_FREE_TIER_CONFIRMED: "true"` et
`BRIGHTDATA_FREE_ONLY_CONFIRMED: "true"`. Elles ne disparaissent donc plus au
déploiement depuis Git. `keep_vars: true` conserve aussi les autres variables
Text ajoutées dans le tableau de bord et absentes de la configuration du dépôt.
Une valeur explicitement déclarée dans `vars` reste pilotée par ce fichier ;
pour révoquer une de ces deux confirmations, modifier aussi le dépôt.
Les clés et jetons restent des Secrets Cloudflare et ne sont pas dans Git.
Cette configuration reprend les confirmations déjà saisies par le propriétaire,
sans vérifier automatiquement la facturation des fournisseurs ni activer une
offre payante.

### 2026-10-15.13 : sources internationales et traduction

18 flux officiels supplémentaires portent le catalogue automatique à 42 :
Check Point Research, SentinelLabs, Unit 42, Google Threat Intelligence/Mandiant,
SecurityLab, Xakep, Doctor Web (alertes virales), AhnLab ASEC, Huntress,
Help Net Security, CERT-EU, CERT-SE, CERT Polska, NVISO Labs, Rapid7, Tenable,
Google Security Blog et Elastic Security Labs. La sélection distingue médias,
CERT et recherche d’éditeurs ; pays, langue et rôle figurent dans le catalogue.
Leurs réponses XML/RSS ont été recherchées via les adresses officielles ; leur
lecture effective depuis Cloudflare demeure indiquée par le diagnostic réel,
qui ne transforme pas un 403 en succès. L’ancien flux Sophos 404 est remplacé
par https://www.sophos.com/en-us/blog/feed. Le lecteur annonce son propre User-Agent,
sans contourner de blocage ni usurper un navigateur.

Les titres en alphabet non latin conservent leurs caractères dans les clés de
regroupement ; un titre uniquement composé de symboles utilise l’URL comme repli.
Le parseur accepte le contenu Atom et résout les liens HTTPS relatifs au flux.
La file Gemini traduit automatiquement titres et extraits après connexion, tous
les 6,5 s entre lots. Les traductions publiques sont conservées au maximum sept jours
et 800 entrées dans localStorage ; les imports manuels sont exclus de ce cache.
Un quota de débit signalé avec délai peut reprendre automatiquement ; un quota
quotidien épuisé suspend la file. Aucun basculement payant n’est activé.
La traduction ne reconstitue jamais un article inaccessible. La fiche propose aussi
un lien explicite Google Traduction pour ouvrir la page source complète en français,
sous réserve de son accessibilité ; ce service externe reçoit l’URL au clic.

Le dernier résultat Gemini est conservé dans SOCIAL_STORE et lié à une empreinte
de la clé et du modèle, sans stocker la clé dans le diagnostic. Sa validité reste
d’une heure ; la conservation évite un retour artificiel à « non testé » à chaque
nouvelle instance. Le bouton de test est accessible dans la carte Gemini.
La carte d’erreur d’import LinkedIn propose directement une relance ciblée afin
de remplacer l’ancien diagnostic sans détails, sans relancer X.

### 2026-10-15.14 : annuaire demandé, Reddit et parcours de formation

Le catalogue comporte 58 sources automatiques, sans doublonner les flux existants.
Ajouts : Dark Reading, Habr Infosecurity, Citizen Lab, Hispasec, El Lado del Mal,
NVD et CISA KEV, ainsi que neuf subreddits (netsec, cybersecurity, blueteamsec,
redteamsec, HowToHack, ReverseEngineering, osint, computerforensics, AskNetsec).
Les discussions communautaires sont identifiées et leur priorité plafonnée à 40 ;
elles ne constituent pas une confirmation primaire. Les refus ou quotas Reddit
restent signalés, sans garantie de lecture continue ni de contournement.

L’ancien RSS NVD retourne 404 : l’adaptateur utilise l’API NVD CVE 2.0 publique,
avec filtre CVSS v3 CRITICAL et fenêtre de publication de 30 jours. Il traite au
maximum les 20 résultats de la réponse : ce n’est pas un inventaire exhaustif des
CVE critiques, ni une preuve d’exploitation. CISA KEV utilise son véritable JSON,
distinct du flux de bulletins CISA. Une criticité CVSS et une présence KEV sont
deux signaux différents. Aucun abonnement ou secret NVD n’est ajouté.

Wiz, TeamT5, le centre canadien pour la cybersécurité et les listes Awesome sont
conservés dans l’annuaire complémentaire. Les adresses de flux qui n’ont pu être
confirmées ne sont pas présentées comme fonctionnelles. Les cadences affichées
sont des conseils de lecture, pas des engagements de collecte en temps réel.

Les requêtes de collecte consultent au maximum 20 sources externes par invocation.
Les lots sont partagés via les clés `feed:` du Durable Object SOCIAL_STORE et
complétés par des requêtes HTTP successives du navigateur. Chaque enregistrement
est borné à 110 Ko et vérifié avant stockage. Un échec peut conserver une copie
précédente pendant 24 h, explicitement signalée comme ancienne ; un cache de plus
de 15 minutes n’est pas présenté comme une vérification récente au vert.
L’API de traduction et les analyses réutilisent les mêmes sources enregistrées.

Tutoriels : 7 parcours, 21 leçons originales en français, dont trois Fondamentaux
(terminal/fichiers, DNS/HTTP, identité/permissions). Le plan indicatif sur quatre
mois relie les leçons à TryHackMe Pre Security / Cyber Security 101, PortSwigger
Web Security Academy, HTB Academy Getting Started et Root-Me. L’ancien lien
TryHackMe Complete Beginner redirige à la date de vérification. Les plateformes
restent externes, leurs conditions d’accès sont affichées, aucun achat ni
abonnement n’est lancé et aucun cours payant n’est reproduit. Les dates sont
indicatives ; les critères de validation guident la progression réelle.

### 2026-10-15.15 : Microsoft, SOC, audit et périmètre cyber élargi

La veille utilise plusieurs étiquettes par publication : Microsoft, SOC,
audit/conformité, identité/accès, correctifs, cloud, DevSecOps, sécurité applicative,
mobile, IoT/OT, cryptographie, données et IA, en plus des thèmes existants.
Les filtres prennent en compte toutes les publications regroupées. Un rapport
SOC 2 n’est pas confondu avec les opérations d’un analyste SOC.

Quatre flux Microsoft Tech Community sont ajoutés : Sentinel, Intune Customer
Success, Defender for Endpoint et Windows IT Pro. Le catalogue automatique passe
à 62 sources ; les lots de 20 et le cache partagé restent inchangés. Les adresses
ont été consultées comme flux XML, mais leur lecture depuis Cloudflare doit être
confirmée par le diagnostic réel. Les contenus accessibles sont traduits selon
le mécanisme Gemini existant, sans activation de dépense.

Tutoriels : 10 parcours, 30 leçons originales en français. Trois nouvelles
spécialisations de trois niveaux :
- Microsoft : état Windows/Defender/pare-feu, Intune/GPO/conformité, correctifs.
- SOC : événements/triage, KQL sur datatable fictive, investigation/escalade.
- Audit : périmètre/référentiels, tests de contrôle/preuves, constats/risques/suivi.
Les manipulations sont en lecture seule ou sur des scénarios fictifs ; aucun
produit cloud ni tenant payant n’est créé ou configuré par l’application.

Un annuaire interrogeable dans Tutoriels présente 20 référentiels (ISO 19011,
27007, TS 27008, 27001, 27002, 27005, NIST SP 800-53, CIS Controls/Benchmarks,
PASSI, SecNumCloud, NIS 2, PCI DSS, SOC 2, PTES, ASVS, WSTG, MASTG, RGPD,
OSSTMM) et les 23 certifications demandées. Les résumés distinguent normes,
guides, qualification, réglementation et attestation, sans reproduire de normes
payantes ni prétendre établir une conformité. L’édition et le périmètre doivent
être vérifiés dans les publications officielles. La préparation indiquée n’est
pas une formation exhaustive ni une garantie de réussite à un examen.

Statuts Microsoft vérifiés sur Microsoft Learn le 15/10/2026 : MS-500 retiré le
30/06/2023 ; AZ-500 retiré le 31/08/2026. Ils sont conservés comme historiques.
Les autres offres et conditions d’inscription sont à revérifier chez leur fournisseur.

### 2026-10-15.16 : contexte complet pour Gemini Pro

Le bouton « Copier le cours + ma question · Gemini Pro » prépare un texte lisible
avec parcours, niveau, objectif, prérequis, leçon précédente, notions, mécanismes,
laboratoire complet (commandes, résultats, interprétation, dépannage, exercice et
corrigé), quiz, sources, enrichissement affiché et huit messages récents de la leçon.
La question de l’utilisateur termine le texte. Un aperçu permet de vérifier ce qui
sera collé ; le clic ne transmet rien automatiquement à Gemini. Le tuteur est invité
à adapter ses explications et à ne pas révéler le corrigé complet d’emblée.
Si le navigateur refuse le presse-papiers, l’aperçu sélectionnable contient le texte
complet sans remplacer ni allonger le champ de question de l’utilisateur.

### 2026-10-15.17 : accès rapides et dépannage des flux

Sources commence par les connexions privées et les commandes de collecte X/LinkedIn.
Le diagnostic peut masquer les sources vertes. Les erreurs 429 décrivent désormais
la limitation du site concerné et imposent une pause avant une nouvelle lecture.
Les téléchargements sont limités à six connexions simultanées ; Project Zero et
Elastic disposent d’une limite de document de 4 Mo et les erreurs de taille sont
identifiées séparément. Les flux Blogger directs et Atom préfixés sont mieux lus.
Une relance de réparation LinkedIn unique est autorisée au prochain passage de
collecte pour un ancien résultat vide, après une heure, sous les confirmations et
le plafond mensuel existants. Elle ne garantit pas de publication reçue.
Validation : 81 tests et construction de l’artefact Worker.

### 2026-10-15.18 : copie Safari et quota Gemini

La copie du cours ouvre toujours un aperçu complet sélectionnable, tente la copie
synchrone du navigateur puis le presse-papiers moderne, et affiche son résultat
séparément des erreurs du tuteur API. L’aperçu reste ouvert après une mise à jour
de la page. Aucun appel API n’est requis pour copier vers Gemini Pro ; le collage
reste une action manuelle dans Gemini. Les erreurs de quota orientent le tuteur
vers ce parcours et le diagnostic vers les quotas Google AI Studio. Le fil propose
une traduction externe de la page source ; ce lien ne remplace pas une traduction
intégrée et les restrictions du site source peuvent empêcher sa lecture.
Les textes déjà français peuvent être reconnus malgré une langue de source anglaise.
Validation : 83 tests, dont copie Safari avec le générateur de contexte réellement
embarqué dans le HTML, et construction valide.

### 2026-10-15.19 : durcissement après audit

Fonctions et stockage conservés : sessions temporaires révocables par onglet,
limitation des essais, coordination persistante des appels Gemini et des lectures
de flux, pause partagée en cas de quota, caches dépendants du contenu, annulation
et purge privée au verrouillage, téléchargements bornés et CSP par nonce.
Le cache de flux reste accessible pendant une extraction sociale lente.
Aucune migration ni clé supplémentaire requise. Le code maître Bearer reste
compatible côté API ; le navigateur échange maintenant ce code contre une session.
`GEMINI_DAILY_REQUEST_LIMIT` (facultatif, défaut 1000/jour UTC) et
`EXTERNAL_CALLS_PAUSED=true` (arrêt Gemini/Bright Data) sont disponibles.
Détails et limites restantes : `audit/CORRECTIONS-SECURITE-2026-10-15.md`.
Validation : 98 tests et construction de l’artefact Worker. Vérification distante
et essai Safari iPhone réel restent distincts des tests simulés.

### 2026-10-16.20 : traductions et références de fuite

Les flux CERT-FR, CERT-EU, CERT-SE et CERT Polska sont retirés du catalogue,
de la collecte et des diagnostics. Les références pédagogiques restent utilisables.
Xakep est reconnu comme un média ; seuls les identifiants X explicites rejoignent
le filtre et la pastille Twitter.

La traduction automatique transmet l’instantané borné réellement affiché,
traite six articles au maximum avec une sortie JSON structurée, réduit le lot après
une réponse invalide et continue avec les autres articles. Titres et extraits sont
évalués séparément : un résumé français ne masque plus un titre russe ou anglais.
Les résultats sont validés, reliés au texte original et conservés individuellement
sept jours dans le stockage privé, avec portée propriétaire/modèle. Les imports
manuels ne sont pas conservés dans ce cache serveur. Un quota Gemini épuisé reste
une limite externe : aucun fournisseur payant ni contournement automatique ajouté.

Le volet « Traduire un lot avec mon abonnement Gemini Pro » prépare jusqu’à douze
titres/extraits, les copie avec repli Safari et importe la réponse JSON collée par
l’utilisateur. Il ne réalise aucun appel API ni envoi automatique au site Gemini.
Les identifiants et textes originaux sont vérifiés avant l’application des traductions.
Les titres et extraits sont traduits ; le lien de lecture externe sert pour la page
complète. Les textes préparés sont effacés au verrouillage.

Les fiches de fuite signalent les plateformes explicitement mentionnées dans les
publications (BreachForums et variantes, RaidForums, forums XSS/Exploit, Telegram…).
La recherche de provenance conserve les citations, inclut les références amont et
sépare les revendications des confirmations rapportées. Les liens de discussion
ne sont affichés que lorsqu’ils sont réellement cités ; aucun domaine inventé,
compte de forum ni récupération de fichiers volés. Une mention n’est pas une
confirmation indépendante de la fuite.

Validation : 112 tests et construction de l’artefact Worker réussis. Les quotas
réels Gemini et les fonctions privées derrière Cloudflare Access restent à tester
dans la session connectée du propriétaire.

### 2026-10-16.21 : profil LinkedIn et images

Bastien Biren (`https://www.linkedin.com/in/biren-bastien`) rejoint la sélection,
sans paramètres de partage : 16 personnes, 10 comptes X et 10 profils LinkedIn.
Les libellés et réservations suivent ces nombres ; le plafond mensuel reste 4 000.
Le profil sera inclus dans la prochaine collecte prévue, sans relance forcée.

Les images fournies par les flux RSS/Atom et les résultats sociaux sont conservées
comme métadonnées (quatre maximum par publication), puis affichées dans un volet
« Images de la publication ». Elles sont chargées directement depuis leur origine
à l’ouverture du volet, sans referrer ni nouvelle collecte payante. Les avatars,
pixels connus, SVG/documents, adresses privées et hôtes non approuvés sont exclus.
La CSP autorise seulement les domaines sources/CDN approuvés ; les scripts restent
protégés par nonce. Un refus/une expiration d’image donne un lien vers l’original.
Les images ne sont pas téléchargées ou transmises au modèle IA par le serveur.

Les profils parents des résultats imbriqués ne fournissent pas leurs photos aux
posts enfants. Une activation/vérification manuelle de collecte peut réimporter
une fois les médias du dernier snapshot existant, sans nouvelle extraction ni
réservation supplémentaire. L’apparition d’une image dépend des données réelles
reçues et de l’accessibilité du CDN ; les anciennes lignes sans médias ne peuvent
pas être complétées à partir de rien.

Options Gemini hors clé API, état non activé du CLI/modèle local et références
vérifiées : `docs/GEMINI-SANS-CLE-API.md`. La copie Gemini Pro existe déjà ; aucune
nouvelle machine, liaison OAuth ou dépense automatique n’a été mise en place.
Validation : 119 tests et construction valide.
