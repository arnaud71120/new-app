# Profils prioritaires — version 2026-10-14.4

14 profils fournis par le propriétaire sont référencés dans Sources, avec liens sans paramètres de suivi. Neuf comptes X : justabreach, mrtuxracer, ced_haurus, gonzague, dfintelligence, dailydarkweb, bluetouff, _saxx_, comcyberfr. Neuf liens LinkedIn sont conservés pour consultation/import manuel ; les noms et correspondances sont ceux fournis par le propriétaire, pas une validation indépendante d’identité.

La requête X par défaut cible ces neuf auteurs avec `from:` et exclut les republications, sans restriction de langue ni de sujet. Une éventuelle variable runtime X_SEARCH_QUERY remplace cette requête : la supprimer pour utiliser la sélection. Au maximum 10 publications récentes par collecte (pas 10 par auteur), cache cinq minutes ; couverture non exhaustive et appels facturables par X. Le label « Compte suivi » indique l’appartenance à la sélection, jamais une vérification des faits ni une augmentation automatique de gravité.

Pas de collecte LinkedIn API ni de lecture des profils à chaque actualisation. Utiliser les liens du répertoire, copier le lien de publication et le texte voulu dans le formulaire d’import. Aucune donnée de compte privée ni mot de passe nécessaire.

---

# Veille mondiale — version 2026-10-14.3

19 flux configurés : CERT-FR, ZATAZ, IT-Connect, BleepingComputer, The Hacker News, SecurityWeek, Krebs on Security, The Record, Schneier, SANS ISC, Talos, Securelist, ESET WeLiveSecurity, Sophos, Microsoft Security, Google Project Zero, CISA, NCSC UK, JPCERT/CC. Catalogue de médias, autorités et recherche complémentaire ; aucun classement universel des « meilleurs » n’est revendiqué. La disponibilité de chaque flux apparaît dans Sources. Jusqu’à 15 publications par flux, pas d’historique durable. Certains flux peuvent changer, limiter les Workers ou inclure des sujets non cyber.

## Français et analyses

Déverrouiller dans Sources, sélectionner Gemini ou OpenAI, puis **Traduire 12 informations en français** dans le fil. Relancer pour le lot suivant. Traduction à la demande avec les frais/quota du fournisseur ; les originaux sont conservés dans les publications de chaque fiche. Les traductions restent dans l’onglet, cache serveur d’une heure. Ce n’est pas une traduction gratuite ni automatique de tous les flux à chaque actualisation.

L’analyse IA donne résumé accessible, fonctionnement technique, analogie/glossaire, impact, mesures défensives, provenance et inconnues. La différence entre connaissances techniques générales et faits de l’incident est explicitement demandée. Gemini est présélectionné lorsqu’il est configuré. Aucun choix de fournisseur caché.

OpenAI : paramètre `max_completion_tokens` conforme à l’API Chat Completions, plafond 2400, Gemini 4096. Les sorties interrompues sont signalées. Erreurs de paramètres et de contexte distinguées des quotas et des clés. Le modèle par défaut reste gpt-4.1-mini ; un modèle personnalisé doit accepter les paramètres de cet endpoint. L’erreur exacte du propriétaire est nécessaire pour confirmer la cause d’un problème de tokens réel.

## Provenance

Bouton **Rechercher les références et la divulgation** : lit jusqu’à trois publications originales, extrait les liens ancrés, examine jusqu’à deux références amont sur un catalogue de domaines publics autorisés. Les redirections sont validées avant chaque requête, aucun téléchargement d’archive ou d’image ; documents limités à 1 Mo, délais bornés. Les sources amont institutionnelles/techniques sont des candidates, pas automatiquement les premières sources. La recherche suit les citations accessibles ; elle ne réalise pas une recherche exhaustive du web et ne visite pas de forum privé, de service Tor ou de dump.

Les plateformes de divulgation citées (BreachForums, Telegram, site de revendication, etc.) portent la mention « emplacement non vérifié » et le lien de la publication qui les nomme. Ce signal est une détection de mention : il peut s’agir de contexte général ou d’une comparaison. L’IA doit évaluer le contexte. Le texte ne prouve ni que les données sont encore disponibles ni où elles sont réellement stockées. Les articles bloqués, payants ou non lisibles restent signalés.

## X et LinkedIn

Erreur X 402 : consulter console.x.com → Crédits, le solde du projet associé à l’application, ses limites budgétaires et les autorisations de recherche récente. L’achat de crédits appartient au propriétaire ; aucun achat ou rechargement automatique n’est effectué par Cyberveille.

LinkedIn ne fournit pas un accès général à son fil via OpenID Connect. Demander Community Management n’assure pas l’éligibilité ni l’accès aux comptes tiers. Solution disponible dans Sources : lien public et extrait copiés par le propriétaire, stockés sur son appareil ; transmis à l’IA à sa demande. Il ne s’agit pas d’une lecture LinkedIn API. Les imports apparaissent sous « Sans date », pour ne pas inventer une date de publication.

## Validation

22 tests automatisés et build Worker valides : parseurs, anglais, catalogue, OpenAI/Gemini, protections, refus des redirections privées, imports LinkedIn, liens non documentaires. Fournisseurs simulés. Disponibilité réelle des 19 flux, API payantes et rendu mobile non vérifiés par ces tests. Aucun secret enregistré dans GitHub. Publication par Cloudflare Builds sur la branche main.

---

# OpenAI et Gemini — version 2026-10-14.2

Dans Cloudflare **Settings → Runtime variables and secrets → Production**, ajouter `GEMINI_API_KEY` de type Secret. Créer la clé dans https://aistudio.google.com/apikey ; ne jamais la publier ni la transmettre dans ChatGPT. Vérifier l’éligibilité du projet, les quotas et la facturation auprès de Google. Le niveau gratuit dépend du modèle et du projet ; il n’est pas garanti.

Modèle Gemini initial : `gemini-2.5-flash`. Variable facultative `GEMINI_MODEL` pour choisir un autre modèle compatible avec le format generateContent et thinkingBudget. Modèle OpenAI initial : `gpt-4.1-mini`, variable facultative `OPENAI_MODEL` pour un modèle compatible Chat Completions.

Après le déploiement, `/api/status` montre `openai` et `gemini` pour la présence des clés. Dans une fiche, choisir **Fournisseur IA**, puis générer. Le code APP_ACCESS_TOKEN est nécessaire pour les deux. Aucun basculement automatique payant : l’utilisateur choisit explicitement le fournisseur. La minute de protection est distincte pour chaque fournisseur ; une seule génération peut être active par instance. Les réponses en cache sont séparées par fournisseur.

Les erreurs distinguent : `insufficient_quota` (OpenAI crédits/budget), `provider_limit` (limite/quota fournisseur), `app_rate_limit` (minute de protection Cyberveille), clé refusée, modèle inaccessible et réponse vide. Aucun message brut de fournisseur ni secret n’est retourné au navigateur. Une erreur de quota n’est pas corrigée en régénérant une clé.

Validation : 15 tests automatiques avec fournisseurs simulés, dont Gemini, quota OpenAI, erreurs, syntaxe du navigateur et refus sans code. La génération avec les vraies clés de l’hébergement reste à tester par le propriétaire.

---

# Mise à jour du 14 octobre 2026

## Activer les connexions

Dans Cloudflare → cyberveille-fr → Settings → Variables and Secrets, conserver les credentials renouvelés et ajouter **APP_ACCESS_TOKEN**, de type Secret : une valeur aléatoire unique d’au moins 24 caractères, générée par un gestionnaire de mots de passe. Ne pas communiquer cette valeur dans ChatGPT.

Dans l’application → Sources, saisir ce code dans « Code d’accès personnel », puis « Déverrouiller les connexions ». Le code reste en mémoire dans cet onglet et disparaît au rechargement. Ce code n’est ni une clé API ni un mot de passe X/LinkedIn.

- **OPENAI_API_KEY** (Secret) : explications à la demande après déverrouillage. Une analyse par minute et par instance Worker, une seule génération simultanée, réponses limitées à 650 tokens, cache d’une heure. Ces limites en mémoire ne sont pas un plafond de dépenses global ; régler les budgets et alertes chez le fournisseur.
- **X_BEARER_TOKEN** (Secret) : bouton « Rechercher sur X » dans Sources. Recherche récente francophone, 10 résultats maximum, lancée explicitement car elle peut coûter des crédits. Cache de cinq minutes par instance, aucun appel X lors du rafraîchissement RSS. Les résultats restent dans l’onglet et peuvent être expliqués avec l’IA. Une erreur 401/402/403/429 est expliquée sans exposer le jeton.
- **X_SEARCH_QUERY** (Variable, facultative) : requête de recherche X personnalisée ; peut cibler des comptes via `from:nom`. Par défaut, recherche cybersécurité, rançongiciels, fuites, vulnérabilités et CVE en français. Ce premier filtre n’est pas encore une liste évaluée des meilleurs comptes.
- **LINKEDIN_CLIENT_ID** (Variable) et **LINKEDIN_CLIENT_SECRET** (Secret) : l’écran indique leur présence. Aucune collecte LinkedIn tant que les produits API, autorisations et parcours OAuth appropriés ne sont établis. La présence d’un secret n’est pas un test de connexion.

La page et les flux publics restent publics. Le code d’accès protège les opérations payantes ; il ne constitue pas un système de comptes ou une protection contre les personnes à qui le code est communiqué. Utiliser Cloudflare Access si une confidentialité complète est souhaitée.

Validation de la mise à jour : 11 tests avec fournisseurs simulés, build Worker valide. Les credentials Cloudflare ne sont pas accessibles depuis cet environnement ; les lectures X et générations OpenAI réelles devront être testées dans l’application. Le déploiement est déclenché par la synchronisation GitHub si Cloudflare Builds est configuré.

---

# Cyberveille

Première version d’une application web française de veille cybersécurité, responsive et sans dépendances pour le développement local. Le code est conservé dans le dépôt privé `arnaud71120/new-app`. L’application n’a pas encore été publiée.

## Fonctionnalités

- Collecte RSS serveur : CERT-FR, ZATAZ et IT-Connect. Adresses initiales à confirmer en production ; les erreurs apparaissent source par source.
- Rafraîchissement toutes les 5 minutes lorsque la page est visible ; cache serveur 60 secondes. Aucun historique durable ni collecte lorsque l’application est fermée.
- Dates Europe/Paris, catégories, recherche, tri par importance dans chaque journée, favoris sur l’appareil.
- Regroupement conservateur : même ensemble de CVE ou titre normalisé identique. Les incidents sans CVE et portant des titres différents peuvent rester séparés.
- Publications et liens cités dans les flux. Le moteur ne parcourt pas les articles complets et ne prouve pas l’origine initiale d’une fuite.
- Score transparent par règles. Ce n’est pas une analyse IA de la gravité réelle.
- Explications et avis de priorité IA à la demande si OPENAI_API_KEY est configurée côté serveur. Les extraits sont alors transmis à OpenAI. Les explications ne modifient pas encore le classement général.
- Démonstration fictive si la collecte échoue ; aucun remplacement silencieux des actualités par des exemples.

## Démarrer sur un ordinateur

Node.js 20 ou ultérieur :

```sh
npm start
```

Ouvrir http://localhost:3000. Vérifier : `npm test` et `npm run build`.

## Voir le rendu depuis un téléphone

Le fichier séparé `cyberveille-apercu.html` est un aperçu autonome avec des exemples fictifs. Les fonctionnalités réseau et IA nécessitent le serveur publié. Selon le téléphone, télécharger puis ouvrir le fichier HTML peut nécessiter un navigateur ou un lecteur HTML ; un lien hébergé reste le moyen recommandé.

## GitHub puis lien public depuis un téléphone

1. Créer un compte sur https://github.com si nécessaire.
2. Créer un dépôt privé nommé `cyberveille`.
3. Depuis le navigateur en mode « site pour ordinateur » si besoin, extraire l’archive et utiliser **Add file → Upload files**. Conserver les dossiers, y compris `.openai` et `.gitignore`. GitHub ne décompresse pas automatiquement une archive téléversée.
4. Pour éviter les limites du téléversement mobile, ouvrir un GitHub Codespace depuis le dépôt, y transférer et extraire l’archive, puis utiliser son panneau Source Control pour faire un commit et synchroniser le code.
5. Lancer `npm start` dans le terminal du Codespace. Ouvrir le port 3000 depuis l’onglet Ports pour tester dans le navigateur. Ce lien de développement cesse de fonctionner quand le Codespace s’arrête.
6. Pour un lien permanent, connecter le dépôt à Cloudflare Workers via **Workers & Pages → Import a repository**. Commande de build : `npm run build`. Commande de déploiement : `npx wrangler deploy`. Le fichier `wrangler.jsonc` désigne le Worker.
7. L’URL `workers.dev` fournie permet de tester sur téléphone. Cette publication Cloudflare est publique : ne pas y ajouter de secrets personnels ou de fonctions privées sans authentification.

Le workflow Sites privé prévu conserve le projet `appgprj_6ace6a0066108191b879c26f3bbc180a`. Les helpers Sites étaient absents de cet environnement ; aucune version ni URL déployée n’a été vérifiée. Le projet enregistré seul n’est pas une application publiée.

## Activer l’IA

La clé `OPENAI_API_KEY` doit être un secret d’hébergement, jamais un fichier suivi dans Git ni un champ dans le navigateur. Pour Sites, utiliser le plugin OpenAI Developers et sa procédure de configuration. Le modèle initial est `gpt-4.1-mini`, à adapter selon les modèles disponibles. Les appels peuvent entraîner des frais.

Ne pas activer une API IA payante sur un déploiement public sans authentification et limite de débit. Le déploiement Sites privé est prévu pour cet usage. La version actuelle vérifie l’origine du navigateur mais cela ne remplace pas l’authentification sur Cloudflare public.

## Prochaines intégrations nécessaires

- Connexion X OAuth pour des usages au nom du compte ; la recherche publique par Bearer Token est désormais disponible. Vérifier les quotas et l’offre API.
- LinkedIn : vérifier l’éligibilité API ; une connexion au compte ne donne pas automatiquement accès au fil personnel. Pas de scraping de comptes privés.
- Sélection de comptes francophones et classement des sources à définir avec l’utilisateur.
- Stockage durable, tâches de collecte planifiées, rapprochement sémantique des incidents, remontée des références dans les articles complets et classement IA central.

## Vérification

Tests automatiques : parseur RSS, URL dangereuses, regroupement CVE, score, syntaxe du script intégré, refus des appels IA interorigines, indication IA absente et collecte partielle avec fetch simulé. Le réseau réel, la génération IA, les navigateurs mobiles et la publication ne sont pas vérifiés dans cet environnement.
