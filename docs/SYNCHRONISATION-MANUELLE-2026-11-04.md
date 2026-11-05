# Synchroniser X et LinkedIn immédiatement — 2026-11-04.2

Le bouton **Synchroniser maintenant**, à côté d’Actualiser, lance X et LinkedIn sans attendre leur prochain horaire. **Administration → Services et horaires / Profils et budget** et le diagnostic des Sources permettent aussi de lancer chaque réseau séparément. **Actualiser** conserve sa fonction de lecture des articles et des flux RSS disponibles.

L’envoi est enregistré immédiatement. Le panneau indique ensuite si la commande attend, démarre une collecte, suit une collecte existante ou importe un résultat. La préparation des publications chez le fournisseur peut continuer après la fin de la commande ; cet état reste affiché comme en cours. Un refus, un quota, une pause ou un lancement incertain reste un avertissement explicite.

## Ce que force le bouton

La commande passe outre la cadence quotidienne ou le prochain horaire configuré. Les passages automatiques conservent leur calendrier ; un nouveau lancement recalcule l’échéance à partir de sa date de démarrage.

Les pauses administratives, la confirmation du compte gratuit, le budget mensuel de 4 000 résultats réservés et les délais `Retry-After` du fournisseur restent appliqués. Un délai partagé d’une minute protège contre les lancements rapprochés. Les réservations sont conservées ; elles ne sont pas une facture. Le bouton exige le rôle administrateur.

Si un snapshot est déjà en cours, la commande vérifie ou importe ce snapshot sans envoyer une nouvelle extraction dans le même passage. Un démarrage incertain n’est jamais relancé automatiquement. Si un résultat dépasse la réservation, les publications reçues restent conservées et la suspension apparaît comme action nécessaire.

## Reprise après une coupure

La demande reçoit un identifiant avant son envoi, conservé pour la session du navigateur. **Reprendre le suivi** consulte cette même demande. Si elle est réellement absente, une action explicite permet de renvoyer le même identifiant. Les réponses perdues, doubles clics et commandes simultanées ne doivent pas provoquer une deuxième extraction. Une commande déjà active rejointe par un autre identifiant conserve un alias durable vers son résultat.

La fermeture de session efface le suivi local. Les résultats côté serveur sont réservés au compte qui a lancé la commande et conservés une heure. Une commande interrompue après son démarrage devient incertaine au bout de trois minutes ; aucun rejeu fournisseur n’est effectué.

## API et validation

`POST /api/sync` reçoit `{ "platform": "all" | "x" | "linkedin", "requestId": "UUID" }` et renvoie immédiatement un travail avec `jobId`, `platform`, `status`. `all` désigne les deux réseaux sociaux. `GET /api/sync?jobId=…` consulte son état sans relancer le fournisseur. Les POST contrôlent l’origine et le débit ; les deux méthodes contrôlent la session et le rôle administrateur.

Les tests couvrent la cadence forcée, les portées, le budget réservé une seule fois, le suivi/import d’un snapshot existant, les pauses, les erreurs fournisseur et leurs délais, les alias et la reprise après redémarrage. Les scénarios Chromium vérifient le bouton, les brouillons conservés, les réponses perdues, les droits, l’expiration et l’affichage des collectes encore en cours. Les appels fournisseur de ces tests sont simulés.
