# Corrections et améliorations — 2026-10-21.1

## Blocage « Session Cloudflare Access expirée »

Le navigateur assimilait toute réponse HTML à une expiration de session. Une page Cloudflare 403, 503, une passerelle défaillante ou un mauvais routage pouvait donc afficher le message de la capture. Ce défaut est reproduit et corrigé. Il ne prouvait pas que le JWT était réellement expiré.

Le transport distingue maintenant une vraie page de connexion, une erreur HTTP de la passerelle, un refus de sécurité et une réponse API illisible. Le statut HTTP et l’identifiant de requête sont conservés lorsqu’ils sont accessibles. Une panne JWKS vérifiable côté Worker retourne une indisponibilité de vérification (503), plutôt qu’un faux diagnostic d’expiration.

Le marqueur interne `Bearer cloudflare-access`, ainsi que le Bearer vide de l’ouverture de session, ne sont plus envoyés à Cloudflare. Les requêtes utilisent explicitement le cookie de même origine. Les codes propriétaires restent transportés comme auparavant ; la vérification cryptographique des JWT, de l’émetteur et de l’AUD est conservée. L’interférence du faux Bearer avec la politique Access de production était une hypothèse plausible ; elle n’a pas été démontrée avec un cookie utilisateur réel.

Une erreur de connexion propose une nouvelle vérification et, lorsqu’une connexion Access est nécessaire, un lien vers la page de connexion officielle. Le contenu et les questions restent disponibles. Aucun appel Gemini n’est rejoué automatiquement après une erreur ou une reconnexion : une réponse incertaine pourrait déjà avoir consommé du quota. Le bouton d’analyse est rendu à nouveau utilisable.

## Autres corrections

- Les incidents de sources ont des identifiants distincts et suivent les rétablissements. Acquitter une panne ne masque plus la suivante.
- Les nouveaux favoris conservent catégorie, score, raisons, publications associées, références et provenance. L’archive est bornée (20 publications) et signale sa troncature. Les anciennes archives restent lisibles ; leurs preuves absentes ne peuvent être recréées.
- Les compteurs de profils correspondent à la configuration active, y compris après désactivation de comptes.
- Un indice de priorité de lecture distingue le catalogue officiel CISA KEV, un score CVSS publié et une simple mention textuelle d’exploitation. Les technologies choisies dans Mon espace influencent ce tri ; l’ancien score lexical reste séparé et explicable.
- Les variantes documentaires sont regroupées prudemment : URL canonique ou titres très proches avec dates et CVE compatibles. Un regroupement n’est pas une confirmation indépendante.
- Recherche, filtres et tri sont mémorisés sur l’appareil. Les fiches ont un lien direct ; la fermeture au clavier met ce lien à jour.
- L’initialisation de l’espace personnel précède désormais le premier affichage, y compris lorsqu’un lien direct ou une vue du fil est restauré.

## Notifications serveur volontaires

Dans **Mon espace → Alertes**, l’utilisateur peut activer ou retirer les notifications serveur sur son appareil. L’application ne crée aucun abonnement automatiquement. Les clés VAPID sont générées côté Durable Object et la clé privée y reste conservée ; elle n’est renvoyée ni dans le diagnostic ni dans les exports. Une configuration explicite par `WEB_PUSH_PRIVATE_JWK`, `WEB_PUSH_PUBLIC_KEY` et `WEB_PUSH_SUBJECT` reste possible.

Le planificateur détecte les nouvelles correspondances de surveillance et les nouveaux incidents. Les notifications n’envoient aucun titre, URL d’article, mot-clé ou contenu privé au service Push ; elles indiquent uniquement que de nouveaux éléments sont à consulter dans l’application protégée. Limites : un groupe par compte et par heure, trois appareils par compte, 200 abonnements pour l’application et huit requêtes Push par passage. Les erreurs HTTP sont disponibles dans les métriques sans exposer les endpoints. Les abonnements expirés ou refusés 404/410 sont supprimés ; les abonnements non renouvelés depuis 90 jours sont retirés.

La pause globale suspend les envois. Les services autorisés sont ceux de Mozilla, Google FCM et Apple. Une autorisation du navigateur est nécessaire ; sa livraison dépend aussi du navigateur et du système. Sur iPhone/iPad, l’installation sur l’écran d’accueil et une version compatible peuvent être nécessaires. La préproduction reste isolée de ces appels externes par défaut.

## Renouvellement des clés Access

La première exécution quotidienne du 21 octobre avait réussi la lecture des clés et les tests, puis échoué au push direct sur `main`, interdit par la protection de branche. Le workflow utilise maintenant une branche réservée, une PR et le vrai contrôle CI sur le SHA exact, puis demande la fusion sans contourner les protections. Une modification du workflow déclenche aussi sa propre recette après fusion, sans boucle sur les PR de clés. Voir [ACCESS-KEY-ROTATION.md](ACCESS-KEY-ROTATION.md) pour l’autorisation GitHub de création des PR et le suivi du déploiement.

Les deux clés publiques officielles ont été relues et le secours borné a été renouvelé. Cela ne démontre pas que le réseau JWKS du Worker de production est rétabli.

## Validation et limites réelles

Les tests unitaires, le runtime SQLite/workerd et les parcours Chromium couvrent notamment HTML403/503, authentification par cookie sans faux Bearer, reconnexion HTML/JSON401 sans double appel Gemini, déconnexion, navigation mémorisée, lien direct et clavier, restauration réelle, incidents successifs, archives, VAPID, refus d’URL Push non autorisée et génération privée des clés.

Les tests n’appellent ni Gemini, ni Bright Data, ni un service Push réel. Ils ne permettent pas de promettre la fraîcheur du fournisseur social, une notification effectivement livrée sur un téléphone ou le résultat d’une requête derrière la session Cloudflare personnelle de l’utilisateur. Les réglages et la recette distante de préproduction restent décrits dans le document de mise en place.
