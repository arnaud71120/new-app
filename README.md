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

- Connexion X par OAuth et API autorisée ; pas de saisie de mot de passe. Vérifier les quotas et l’offre API.
- LinkedIn : vérifier l’éligibilité API ; une connexion au compte ne donne pas automatiquement accès au fil personnel. Pas de scraping de comptes privés.
- Sélection de comptes francophones et classement des sources à définir avec l’utilisateur.
- Stockage durable, tâches de collecte planifiées, rapprochement sémantique des incidents, remontée des références dans les articles complets et classement IA central.

## Vérification

Tests automatiques : parseur RSS, URL dangereuses, regroupement CVE, score, syntaxe du script intégré, refus des appels IA interorigines, indication IA absente et collecte partielle avec fetch simulé. Le réseau réel, la génération IA, les navigateurs mobiles et la publication ne sont pas vérifiés dans cet environnement.
