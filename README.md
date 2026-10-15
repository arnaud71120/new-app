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
