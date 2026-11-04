# Administration et vérification des sources — 2026-11-04.1

Les captures montrent un HTTP 503 dans l’administration et après la sélection de `@tariqkrim`. Ce compte répond lors de deux vérifications publiques réelles ; le module de vérification reconnaît ses métadonnées en moins d’une seconde. Dans workerd, un HTTP 503 du site source produit une réponse applicative HTTP 200 avec `status: "unverified"` et `httpStatus: 503`. Un JWT signé du propriétaire conserve son rôle administrateur, y compris lors de plusieurs requêtes simultanées.

Ces vérifications ne reproduisent pas le 503 exact de la session de production. Elles ne permettent pas d’attribuer cette panne au CPU, au stockage ou à la passerelle Cloudflare sans diagnostic supplémentaire.

## Corrections

- L’administration et le journal demandent des résumés des flux : nombre de publications, dernière date et état de lecture. Les textes complets restent réservés aux fonctions qui en ont besoin. L’état social est également lu sans transférer les publications complètes ni recalculer leurs mentions.
- Les erreurs des états facultatifs (flux, sondes, état social) sont rendues comme avertissements avec leur étape. La configuration et les droits restent accessibles si leur lecture réussit. Une erreur de configuration continue de refuser les écritures ; aucun rôle n’est promu en cas de panne.
- Les lectures de configuration d’une même requête sont partagées. Les lectures des états ont un délai borné.
- Un échec de chargement ne transforme plus un rôle inconnu en prétendue restriction d’éditeur. Les brouillons restent présents et les écritures attendent une lecture valide de la configuration.
- Le journal n’est plus demandé après l’échec de l’administration, et une erreur de relecture après une modification acceptée n’est plus remplacée par un faux succès complet.
- Les diagnostics affichent l’API concernée, le service, l’étape, le code et la référence de requête. Les réponses JSON d’erreur portent `code`, `service`, `stage`, `requestId` ; cette référence correspond à l’en-tête `X-Request-ID`. Les pages d’erreur Cloudflare conservent leur référence `CF-Ray` lorsqu’elle existe. Les erreurs ne renvoient pas les exceptions internes, secrets ou jetons.
- Les clés publiques de secours de l’émetteur Access épinglé sont renouvelées, avec une fenêtre toujours limitée à sept jours.

## Validation

Les tests workerd injectent des pannes entre le véritable handler et le Durable Object SQLite : une panne des diagnostics facultatifs garde la configuration et le rôle, tandis qu’une panne de configuration ou de coordination renvoie un 503 identifié sans autoriser de nouvelle écriture. Ils contrôlent aussi l’absence de corps de publications dans les transferts de synthèse et la conservation des compteurs et dates.

Les scénarios Chromium couvrent le HTML 503 de passerelle, le JSON 503 interne, le HTTP 503 du site source, le chargement initial ou ultérieur en panne, la reprise, les avertissements partiels et la modification acceptée suivie d’une relecture indisponible. Les tests de rôles lecteurs et éditeurs restent appliqués.
