# Correction du blocage de collecte — 2026-10-16.25

## Défaut reproduit

Les réponses HTTP refusées des flux étaient abandonnées sans annuler leur corps. Sur un environnement limité à six connexions simultanées, ces réponses gardent les emplacements occupés et les téléchargements suivants attendent. Le chargement attendait en outre la fin de tous les lots avant d’afficher le premier article.

Reproduction avec un transport simulant six connexions et des réponses 403 dont le corps reste ouvert : ancienne version, 12 demandes engagées, six connexions occupées, aucune réponse achevée ; version corrigée, quatre demandes, quatre réponses annulées et aucune connexion restante, lot achevé. Ce scénario reproduit le défaut de gestion des réponses ; la session privée de production de l’utilisateur n’est pas disponible pour inspecter les journaux Cloudflare.

## Corrections

- Annulation des corps des réponses HTTP refusées et des documents annoncés trop volumineux, et fermeture des réponses internes d’écriture.
- Lots de quatre sources, avec au plus quatre téléchargements simultanés et sept secondes maximum pour une lecture externe, au lieu de vingt sources et six téléchargements.
- Délais explicites sur la lecture et la persistance du cache ainsi que la coordination de sécurité ; les erreurs de coordination restent bloquantes pour les opérations protégées.
- Une source déjà en cours de collecte dans un autre onglet est temporairement différée pour laisser avancer les autres sources, au lieu de monopoliser tous les lots.
- Lecture initiale `/api/feed?snapshot=1` : affiche les données conservées sans télécharger les flux externes, puis collecte progressivement les lots.
- Affichage après chaque lot, sans attendre la fin des 58 sources. Une panne ultérieure conserve les données déjà reçues et rend le bouton Actualiser disponible.
- Conservation du dernier fil public en mémoire si un instantané vide arrive pendant un problème de cache ; aucun mélange des exemples fictifs dans le fil réel.
- Messages spécifiques à la collecte : pas de renvoi vers Gemini pour résoudre une panne de flux, et pas de mention de contenu conservé quand aucun article n’a été chargé.
- Lecture des publications sociales conservées indépendante de la file des extractions lentes ; les lancements et interrogations qui modifient le suivi restent coordonnés.
- Vérifications de versions des outils limitées à quatre connexions et fermeture des réponses refusées.
- Les champs des cours et de Sources ne sont pas reconstruits à chaque lot pendant que l’utilisateur les consulte.

## Vérification

136 tests réussis et construction du Worker valide. Nouveaux contrôles : corps HTTP refusés annulés, corps surdimensionnés annulés, instantané sans téléchargement externe, délai d’un stockage muet et maintien des refus de sécurité, affichage avant fin de collecte et conservation après échec d’un lot.

Essai réel depuis l’environnement de développement : le premier lot ZATAZ, IT-Connect, BleepingComputer et The Hacker News a retourné 54 informations regroupées en environ 1,5 seconde. Ce résultat ne garantit pas les mêmes réponses depuis les adresses réseau Cloudflare ; les sources peuvent toujours répondre 403/429 ou être temporairement indisponibles.

Recette Chromium : cache affiché puis premier lot affiché alors que le suivant reste volontairement en attente ; articles conservés après réponse 503 du lot suivant ; bouton Actualiser réactivé ; message sans référence Gemini ; cours et guides accessibles ; aucun débordement à 390 px ni erreur JavaScript.

Aucun retrait de fonctionnalité, changement de secret ou de facturation. Les données du stockage ne sont ni effacées ni réinitialisées. La connexion Cloudflare automatique, la collecte sociale selon échéance, les quotas, favoris, parcours et 33 guides restent présents. Les erreurs de quota Gemini et les refus des éditeurs restent dépendants de ces services.
