# Administration — version 2026-10-19.6

Ouvrir **⚙ Administration**, à côté d’Actualiser. La même session privée
Cloudflare que celle des fonctions protégées est nécessaire. Les API vérifient
cette session côté serveur et l’origine des écritures. Aucun nouveau rôle ou
compte utilisateur n’est créé ; l’audience reste celle de la politique Access.

## Sources

- Ajouter un flux RSS/Atom HTTPS public, modifier son nom, ses adresses, sa
  langue et son intervalle minimum, l’activer, le désactiver ou le supprimer.
- Les sources JSON spécialisées existantes conservent leur parseur.
- Tester un flux enregistré : code HTTP, étape de téléchargement/analyse,
  durée et nombre d’articles reconnus. Le test est limité à un par source et
  par minute et n’importe pas ses résultats dans le fil.
- Filtrer la liste par nom, adresse, état ou code (403, 404, timeout…).
- Restaurer les réglages initiaux d’une source intégrée, y compris une source
  intégrée supprimée depuis la rubrique Journal. Une source personnalisée
  supprimée peut être recréée depuis les informations d’un export préalable.

Le catalogue est persistant dans le Durable Object SOCIAL_STORE, clé
`admin:config`. Les modifications sont utilisées par les lectures suivantes
sans redéploiement. L’édition et la suppression invalident le cache de cette
source. Les articles conservés d’une source supprimée sont exclus des nouveaux
instantanés publics. Les écritures utilisent une révision pour éviter qu’un
onglet écrase les modifications d’un autre.

Les intervalles sont des délais minimums : les flux sont téléchargés lors de
l’ouverture ou d’une actualisation, et non par une tâche quotidienne dédiée.
Le prochain passage affiché est une échéance possible, pas une garantie
qu’un téléchargement sera lancé à cette seconde. Les codes 429 conservent
leurs délais de reprise.

## Services et horaires

- Suspendre/reprendre les téléchargements des flux tout en lisant le cache.
- Suspendre/reprendre les nouveaux lancements Bright Data. Le suivi et
  l’import des snapshots déjà en cours restent possibles ; aucune réservation
  mensuelle n’est effacée et aucun lancement forcé n’est ajouté.
- Consulter, pour X/LinkedIn : dernière tentative, fin de collecte, dernier post
  conservé, prochain passage possible, statut, nombre de lignes et détails
  fournisseur, messages de suspension et réservations mensuelles.
- Consulter Gemini : présence de la clé, confirmation du projet gratuit,
  modèle et dernier résultat conservé ; lancer explicitement le test court
  existant, soumis aux quotas et confirmations existants.
- Consulter le diagnostic Access, la provenance et l’expiration du secours
  JWKS, ainsi que l’interrupteur runtime d’arrêt des appels externes.

L’interface n’affiche ni ne modifie les secrets. Ceux-ci restent dans les
variables runtime Cloudflare. Le cron social de quinze minutes doit être
présent sur le déploiement Cloudflare pour agir lorsque le site est fermé ;
le backend ne prétend pas avoir vérifié le déclencheur dans le compte cloud.
Les profils suivis et les plafonds Bright Data existants ne sont pas modifiés.

## Journal et export

Les cent dernières modifications du catalogue et des pauses sont conservées.
Les dernières observations automatiques et les derniers tests manuels sont
présentés séparément sur les fiches sources. Exporter la configuration génère
un fichier JSON local sans clé API. L’import de fichier, les notifications,
les rôles multiples et les historiques détaillés de chaque téléchargement ne
font pas partie de cette version.

## API

`GET /api/admin` lit les états conservés, sans extraction sociale ni appel IA.
`POST /api/admin` accepte `save`, `delete`, `restore`, `pause` et `test`.
Les modifications exigent la révision reçue en lecture ; une révision périmée
renvoie HTTP 409. Sans session : 401 ; origine étrangère : 403 ; commande
invalide : 400 ; débit dépassé : 429 ; stockage indisponible : 503.
Les adresses non HTTPS, locales, IP littérales, avec credentials ou clés dans
la query sont refusées. Les redirections restent limitées aux domaines
configurés et autorisés. Taille du catalogue/configuration et corps lus bornés.

## Validation

184 tests passent, dont création persistante puis collecte et relecture dans
une autre instance Worker, changement d’URL et invalidation, concurrence,
pauses, refus d’accès/origine, secret non exposé, HTTP 403, redirection vers
une adresse privée bloquée, HTML au lieu de RSS et échappement HTML du panneau.
Le build produit un Worker ESM autonome incluant les nouveaux modules.
Le JavaScript généré est exécuté par les tests VM Node. L’interface mobile et
les services de production protégés restent à vérifier après déploiement.
