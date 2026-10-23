# Analyses Gemini durables — version 2026-10-23.1

Le bouton d’analyse utilisait une requête synchrone qui regroupait tout le cache, recherchait les publications liées et lisait plusieurs pages publiques avant d’appeler Gemini. Les lectures de pages et l’appel IA pouvaient cumuler environ 90 secondes. Une interruption de cette requête perdait le résultat côté navigateur et pouvait être présentée comme une expiration de session.

La capture du 23 octobre montre une réponse de passerelle HTTP 503 accompagnée d’une référence Cloudflare. Elle ne prouve pas un dépassement CPU : les journaux de production restent nécessaires pour en établir la cause exacte. Le correctif supprime les traitements coûteux et l’attente fournisseur de la requête initiale.

## Nouveau parcours

- `POST /api/analysis` enregistre une demande dans le Durable Object existant, puis répond immédiatement avec son identifiant et HTTP 202.
- Le traitement sélectionne uniquement les publications conservées correspondant aux URL et aux sources choisies. Il accepte aussi les favoris privés et l’import manuel LinkedIn validé.
- Le navigateur suit l’état par `GET /api/analysis?jobId=…` : enregistrement, préparation, génération, résultat ou erreur. Le résultat est conservé une heure pour le compte connecté.
- Un même identifiant et un même contenu reprennent la demande existante. Un contenu différent pour cet identifiant est refusé. Les identifiants sont conservés dans `sessionStorage` pour reprendre après rechargement ou perte de l’accusé de réception.
- Une interruption après l’envoi à Gemini devient un état « incertain ». Aucun appel fournisseur n’est rejoué automatiquement. Un nouvel essai exige une confirmation explicite, car le précédent peut avoir consommé du quota.

La lecture des pages et la recherche de provenance restent disponibles via leurs boutons dédiés. Elles ne conditionnent plus la génération. L’analyse s’appuie sur les extraits conservés ; elle ne prétend pas avoir lu les pages absentes de ces données. L’ancien endpoint `/api/explain` reste compatible avec les anciens clients, avec une sélection bornée et sans lecture implicite des pages.

## Limites et diagnostics

La sélection contient au plus 12 publications et 40 Ko de données pour le modèle. Chaque demande possède une échéance de deux minutes et une conservation d’une heure, avec au plus 20 demandes par compte et 100 au total. Cette échéance clôt le suivi sans garantir l’annulation d’un appel déjà reçu par Gemini. La maintenance périodique élimine les résultats expirés. Les tâches interrompues ne sont pas rejouées après un redémarrage.

Les contrôles d’identité, d’origine, de projet Gemini gratuit, de pause administrateur et les limites partagées de quota restent appliqués. Les résultats sont isolés par compte. La pause est vérifiée avant préparation et avant génération.

Une erreur HTTP renvoyée par Gemini est conservée dans la tâche avec `providerHttpStatus`, même si sa réponse est HTML. Elle se distingue ainsi d’une erreur de transport Cloudflare. Le journal d’exploitation reçoit la durée, l’étape, le code et l’identifiant des appels terminés ou interrompus, sans exposer les clés API ni les réponses brutes d’exception.

Les traductions automatiques attendent la fin du suivi de l’analyse interactive dans l’onglet. Une réponse tardive d’une fiche ne s’affiche pas dans une autre fiche ouverte entre-temps.

## Validation

Les tests couvrent la sélection de données stockées, les limites de taille, l’isolation des comptes, les doublons, les interruptions, les délais, la capacité et l’expiration. Les tests Chromium couvrent les doubles clics, la reprise après erreur de passerelle ou rechargement, les changements de fiche, la coordination avec les traductions et la confirmation d’un nouvel essai incertain.

Un scénario dans le véritable runtime local Cloudflare, avec stockage SQLite et fournisseur simulé, vérifie que le POST répond avant Gemini, qu’une reprise n’effectue qu’un seul appel, que les erreurs fournisseur sont conservées et que la pause administrateur interdit un nouvel appel. Aucun appel au véritable compte Gemini de production n’est effectué par ces tests.
