# Renouvellement du secours public Cloudflare Access

Le workflow quotidien ne pousse pas directement vers `main`, qui exige une PR et le contrôle `tests-obligatoires`. Il renouvelle seulement `worker/access-jwks.js`, réutilise la branche réservée `automation/access-public-keys`, ouvre une PR, déclenche explicitement `tests.yml` par `workflow_dispatch` et attend sa réussite sur le SHA exact avant de demander la fusion à GitHub.

Ce déclenchement explicite est nécessaire : les pushes et PR créés avec `GITHUB_TOKEN` ne déclenchent pas les workflows ordinaires `push` et `pull_request`. Aucun statut de contrôle n’est fabriqué. La CI garde les tests unitaires, le runtime Cloudflare et Chromium. GitHub applique encore les règles de protection à la fusion ; le bot ne dispose d’aucun contournement.

Dans **Settings → Actions → General**, Actions doit être activé et **Allow GitHub Actions to create and approve pull requests** doit autoriser la création de PR par le bot. Le workflow déclare `contents:write`, `pull-requests:write` et `actions:write`. Si une règle impose une revue humaine ou refuse ces permissions, le workflow échoue avec un message explicite et la PR reste à traiter : ne pas considérer le renouvellement comme réussi tant que la fusion puis le déploiement n’ont pas abouti.

La branche réservée ne peut contenir que les clés publiques ; une branche modifiée par un autre auteur ou avec d’autres fichiers n’est pas écrasée. Une mise à jour concurrente est refusée par un lease Git sur le SHA distant attendu. Le commit de la PR est également vérifié par son SHA lors de la fusion.

Le premier workflow de l’ancienne version a échoué le 21 octobre 2026 à 11:21 (Paris) : [exécution 39576302753](https://github.com/arnaud71120/new-app/actions/runs/39576302753). La récupération JWKS et les tests avaient réussi ; le push direct était rejeté par `GH006` (« Changes must be made through a pull request », contrôle obligatoire attendu).

Les clés restent publiques, épinglées à l’émetteur officiel et limitées à sept jours. Cette automatisation ne répare pas le réseau JWKS du Worker et n’allonge jamais indéfiniment une clé expirée. Vérifier aussi que le déploiement Cloudflare suit les fusions du bot : les workflows Actions `push` ne sont pas déclenchés par les opérations de `GITHUB_TOKEN`, et une éventuelle chaîne de déploiement reposant elle-même sur Actions doit prévoir son déclenchement explicite. Le branchement Cloudflare Git doit être contrôlé séparément.
