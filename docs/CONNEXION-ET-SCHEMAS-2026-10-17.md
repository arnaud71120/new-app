# Connexion automatique et cours illustrés — 2026-10-17.1

## Connexion et actualisation

Le bandeau affichait « vérification en cours » dès qu'aucun jeton client n'était
présent, même après une erreur. Le démarrage ne faisait qu'une vérification et
ne tentait pas de restaurer une session si `/api/status` échouait. Autre défaut :
le délai réseau était arrêté à la réception des en-têtes, avant la lecture JSON.
Un corps de réponse bloqué pouvait donc laisser l'interface attendre indéfiniment.

La vérification possède maintenant des états checking, connected, disconnected
et expired. Status et session disposent d'un délai de 12 secondes couvrant aussi
le JSON. Une seule vérification peut tourner à la fois. Après une panne, reprise
à 30, 60, 120, 240 puis 300 secondes maximum ; contrôle toutes les cinq minutes
après un succès. Une reconnexion réseau ou un retour dans l'onglet relance les
vérifications utiles. Actualiser et le bandeau permettent une reprise immédiate.
Une session expirée propose de recharger pour passer par Cloudflare Access.
La fermeture de session annule les reprises automatiques.

La validation de session n'attend plus la réponse de Bright Data. Le fil conserve
sa collecte progressive indépendante et les données reçues avant une erreur.
Aucune clé personnelle ou activation manuelle n'est réintroduite.

Si l'en-tête Access n'est pas transmis, le Worker accepte aussi le cookie
CF_Authorization, avec exactement la même vérification RS256, JWKS, émetteur,
audience, expiration et identité. Un en-tête présent mais invalide reste refusé,
même en présence d'un cookie valide. Aucun simple nom de cookie ou e-mail ne donne
accès. L'accès Cloudflare reste obligatoire pour le trafic du site.

## Illustrations intégrées

Les 42 leçons des 12 parcours ont chacune une séquence pédagogique spécifique :
quatre étapes, un vrai schéma SVG avec pictogrammes, flèches et légendes, une
explication sélectionnable, lecture animée volontaire, pause et remise à zéro.
Les schémas sont affichés dans les cartes, sans ouvrir le cours ni appeler une IA.
Les légendes détaillées restent lisibles sur mobile et sont incluses dans le
contexte copié à Gemini. Une vue complémentaire rappelle le montage du laboratoire
et sa topologie réelle décrite par la leçon.

Ces illustrations expliquent un mécanisme ou une démarche ; ce ne sont ni des
captures des consoles Microsoft/Palo Alto ni des observations de la machine de
l'utilisateur. Aucun média externe, pixel de suivi, GIF volumineux, bibliothèque
ou dépendance de production n'est ajouté. Les SVG ont titres et descriptions,
les boutons fonctionnent au clavier, l'animation est arrêtée hors du parcours,
et le mouvement des flèches respecte la préférence de réduction des animations.

## Vérification et limites

149 tests automatisés réussis ; artefact Worker construit et validé.
Tests navigateur Chromium à 390 px et 1440 px : panne status puis reprise,
collecte indépendante, navigation des 42 schémas, sélection d'étape,
lecture/pause/remise à zéro, absence de débordement et d'erreurs JavaScript.

Les contrôles de connexion privés utilisent des réponses simulées et les tests
JWT utilisent des clés de test. Sans session du propriétaire, ils ne constituent
pas une connexion réelle au tenant Cloudflare, à Gemini ou à Bright Data.
Les nouvelles tentatives ne créent pas de quota Gemini supplémentaire et les
garde-fous de collecte gratuite restent actifs.
