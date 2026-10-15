# Corrections de sécurité — Cyberveille 2026-10-15.19

## Changements appliqués

Le fonctionnement et les données de l’application sont conservés. Aucune source,
aucun parcours de cours et aucun fournisseur actif n’a été retiré. Les identifiants
Cloudflare, la migration du stockage, les réservations et les posts existants sont
conservés. Aucun secret supplémentaire n’est requis.

| Constat de l’audit | Traitement |
|---|---|
| A01 : limites IA | Coordinateur persistant séparé, une génération à la fois, limite de débit partagée, plafond quotidien et pause commune après quota fournisseur |
| A02 : charge publique | Limitation par IP et route, baux de rafraîchissement par source partagés entre instances ; lectures du cache indépendantes des longues extractions sociales |
| A03 : tentatives d’accès | Limitation persistante du point de connexion et des tentatives Bearer invalides sur les opérations privées ; pas de verrouillage permanent du compte |
| A04 : sessions | Échange du code personnel contre un jeton aléatoire, révocation serveur, 12 h maximum et 2 h d’inactivité ; rotation du code invalide les sessions |
| A05 : verrouillage | Annulation des requêtes privées, contrôle de génération sur les réponses, fermeture des fenêtres et purge des dialogues, brouillons, analyses et copies temporaires |
| A06 : taille d’entrée | Limites d’octets pendant la lecture, annulation immédiate du flux ; limites métier conservées pour questions, historique et imports |
| A07 : fournisseurs | Gemini et Bright Data bornés avant désérialisation, tailles d’URL et nombre de résultats contrôlés ; cache lu sans attendre une extraction sociale lente |
| A08 : navigateur | CSP par nonce aléatoire, aucun script inline autorisé sans nonce ; en-têtes Permissions-Policy, Referrer-Policy, nosniff et HSTS sur HTTPS |
| A09 : redirections | Redirections de flux suivies manuellement, nombre de sauts limité, HTTPS sans credentials/port inhabituel et destinations officielles autorisées |
| A10 : finances | Garde-fous existants maintenus ; interrupteur d’urgence EXTERNAL_CALLS_PAUSED et plafond quotidien applicatif Gemini ; aucun basculement payant |
| A11 : cache | Clés par empreinte du contenu, version de prompt, modèle et identité du propriétaire ; modification d’un extrait sur une même URL correctement prise en compte |
| A12 : rétention | Notice de transmission corrigée, purge effective des traductions expirées au chargement ; nouvelles traductions sociales/manuelles non persistées dans localStorage |

Le bouton de verrouillage conserve les favoris et la progression. Les imports
manuels durables restent sur l’appareil, conformément au comportement antérieur,
mais ne sont plus rechargés dans le fil verrouillé. La copie de cours vers Gemini
Pro reste indépendante des quotas API et conserve le repli manuel Safari.
Le presse-papiers du système, après une copie volontaire, reste sous le contrôle
de l’utilisateur ; le verrouillage ne peut garantir son effacement.

## Paramètres et compatibilité

- Pas de modification nécessaire de Wrangler ni de réinitialisation du Durable Object.
- Le même binding SOCIAL_STORE est réutilisé avec une instance distincte
  `cyberveille-security-v1`. Ses alarmes purgent uniquement les métadonnées de
  sécurité et ne peuvent pas lancer une deuxième collecte sociale.
- `GEMINI_DAILY_REQUEST_LIMIT` est facultatif : 1 000 requêtes/jour UTC par défaut,
  valeur entière souhaitée entre 1 et 5 000. Ce plafond est un garde-fou et ne
  garantit pas le quota réellement fourni par Google. Huit appels/minute maximum,
  coordination commune à tous les onglets/instances.
- `EXTERNAL_CALLS_PAUSED=true` arrête les appels Gemini et Bright Data. Les cours,
  les données déjà stockées et la copie vers Gemini Pro restent utilisables.
- Les limites de connexion sont temporaires, par IP, partagées entre les instances.
- Hors Cloudflare/DO, le serveur de développement conserve une coordination locale
  en mémoire ; ce mode n’apporte pas les garanties de persistance de la production.
- Le serveur local écoute 127.0.0.1 par défaut. `DEV_HOST=0.0.0.0` permet toujours
  une prévisualisation réseau explicite. Les anciennes variables de fournisseurs
  inactifs ont été retirées de ce script de développement uniquement.

## Limites restantes explicites

1. Le jeton de session temporaire reste dans sessionStorage pour conserver le
   fonctionnement par onglet et les usages intégrés. Ce n’est pas un cookie
   HttpOnly : une exécution JavaScript malveillante réussie pourrait le lire.
   La CSP est durcie, mais cela ne remplace pas toute validation de contenu.
2. Le code maître Bearer reste accepté côté serveur pour compatibilité API et
   transition des anciennes sessions. Il n’est plus conservé par le navigateur
   après échange. Sa compromission nécessite toujours une rotation du secret.
3. Les en-têtes ne prouvent pas les réglages edge : WAF, rôles/MFA, sauvegardes,
   restauration, facturation réelle et permissions des comptes doivent encore être
   vérifiés chez les fournisseurs. Les budgets d’alerte ne sont pas nécessairement
   des plafonds financiers bloquants.
4. Les redirections autorisées couvrent les hôtes officiels déjà catalogués et
   FeedBurner. Une future migration vers un autre hôte nécessite un ajout explicite,
   avec diagnostic en attendant. Aucune source n’a été supprimée du catalogue.
5. Les gardes de débit modifient seulement le rythme des requêtes abusives ou
   excessives. Ils ne suppriment pas les fonctions légitimes, mais un réseau avec
   beaucoup de clients partageant une IP peut rencontrer le délai temporaire.
6. La coordination par source évite les téléchargements simultanés ; le fil n’est
   pas devenu un service CDN complet. Les sources externes peuvent toujours
   répondre 403/404/429 ou renvoyer un format inutilisable.
7. La purge des traductions expire à sept jours. Les imports manuels restent
   limités à 30 et persistants comme avant ; aucune suppression automatique
   supplémentaire des données personnelles durables n’a été introduite.

## Validation

- 98 tests réussis au moment de la validation, dont 15 nouveaux contrôles de
  sécurité et de non-régression par rapport aux 83 tests précédents.
- Construction et validation de l’artefact Worker réussies.
- Scénarios nouveaux : expiration/révocation/rotation, rafale de connexion,
  lecture bornée, nonce CSP et validité du script, concurrence entre instances,
  quota partagé, plafond quotidien et arrêt propriétaire, absence de lancement
  social par l’alarme de sécurité, cache accessible malgré une extraction lente,
  redirections, réponse fournisseur excessive, cache modifié, annulation à la
  déconnexion, conservation de progression/favoris et reprise de traduction.
- Les fournisseurs sont simulés dans ces tests : aucun nouveau crédit consommé.
- Les tests de copie Safari utilisent le code réellement intégré au HTML dans un
  environnement simulé. L’essai sur iPhone physique et la vérification du déploiement
  Cloudflare ne sont pas remplacés par ces tests.

Le script historique `audit/security-checks.mjs` et ses résultats décrivent
l’audit antérieur de la version .18 ; ils ne constituent pas la recette de cette
version. La recette courante est `node scripts/test.mjs`, puis `npm run build`.
