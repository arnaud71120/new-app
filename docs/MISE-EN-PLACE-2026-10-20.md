# Mise en place après la revue — 2026-10-20.1

Cette livraison met en place les fonctions côté application. Les configurations Cloudflare et la fraîcheur réelle des réponses Bright Data doivent être vérifiées sur le service déployé : un test local réussi ne prouve pas qu’un fournisseur livre les dernières publications.

## Utilisation

- **Administration → Sources** : ajouter, modifier, désactiver, supprimer, restaurer et tester une source. Import JSON ou OPML, validation des URL et dédoublonnage.
- **Administration → Opérations** : étapes des lectures, HTTP, délais, erreurs, nouveaux posts, doublons, couverture des sources et profils, passage observé du planificateur, export de diagnostic sans clés. Arrêt global des appels externes et activation de la planification RSS.
- **Administration → Profils** : modifier les comptes X/LinkedIn, activer ou désactiver un suivi, régler sa priorité et les intervalles. Prévision conservatrice sur 31 jours avant enregistrement ; les réservations déjà consommées ne sont pas effacées.
- **Administration → Sauvegardes** : 20 configurations précédentes et corbeille des sources. Une restauration crée une nouvelle révision et préserve les rôles courants.
- **Administration → Droits** : lecteur, éditeur de sources, administrateur. Cloudflare Access reste obligatoire ; un rôle applicatif n’accorde pas l’entrée dans Cloudflare.
- **Mon espace** : favoris avec copie durable, notes et tags, sélection non lue, surveillance CVE/produits/mots-clés, dossiers chronologiques, briefing Markdown, alertes, progression et notes de formation, export/import et lecture hors ligne choisie.
- Les anciennes étoiles locales peuvent être transférées depuis **Mon espace → Conserver les anciens favoris**. Seules les publications encore chargées peuvent être récupérées à partir d’anciens identifiants seuls.

Les données personnelles sont stockées par identité vérifiée, avec révision pour gérer deux appareils simultanés. Les favoris locaux hors ligne utilisent AES-GCM et PBKDF2 avec un mot de passe de 12 caractères minimum, non conservé. La déconnexion supprime cette copie. Les notifications nécessitent une autorisation explicite et fonctionnent pendant l’utilisation du navigateur ; aucune livraison navigateur fermé n’est promise.

## État des recommandations

| Référence | État et résultat |
|---|---|
| R01 | Atténué : clés publiques épinglées renouvelées, vérification JWT conservée, diagnostic DNS/TLS/runtime plus précis et workflow quotidien de renouvellement. La panne JWKS du Worker reste à confirmer/résoudre dans Cloudflare ; le secours reste borné dans le temps. |
| R02 | Implémenté : arrêt global sur flux, collecte sociale, IA, provenance et versions des outils. Les vérifications d’accès restent utilisables. |
| R03 | Implémenté : publications reconnues, uniques, nouvelles, déjà connues et doublons distingués. |
| R04 | À valider chez Bright Data : le code ne prouve pas que ses filtres de dates sont respectés ni que ses résultats X sont exhaustifs. Aucun appel facturable supplémentaire réalisé pour cette recette. |
| R05 | Implémenté : variantes snake_case de republication normalisées. |
| R06 | Implémenté : normalisation des noms DNS avant rejet des adresses internes. |
| R07 | Implémenté : transaction configuration/journal/sauvegarde/invalidation ; rollback testé. |
| R08 | Implémenté : autorisations lecteur/éditeur/admin côté serveur. |
| R09 | Implémenté : calendrier par défaut compatible avec 4 000 réservations et validation des calendriers explicites. |
| R10 | Implémenté : copie durable des favoris, utilisable hors du cache courant. |
| R11 | Implémenté : journal borné à 500 exécutions, 200 dernières consultables, export du diagnostic. |
| R12 | Implémenté : cron RSS par lots, indépendance des échecs RSS et sociaux, témoin de passage. Déclencheur à observer en production. |
| R13 | Implémenté : CVSS v4, requêtes v3/v4 et pagination NVD bornée à deux pages de 2 000 résultats par version ; résultat partiel signalé, pas de promesse d’exhaustivité. |
| R14 | Implémenté : catalogue pédagogique différé et fil limité à 40 fiches puis chargement supplémentaire. |
| R15 | Avancé : modules administration, espace personnel, opérations, catalogue et client séparés ; bundle esbuild verrouillé. Le cœur API reste important et peut encore être découpé. |
| R16 | Implémenté localement et en CI : tests unitaires, runtime workerd/Miniflare et Chromium mobile. La préproduction distante nécessite sa configuration. |
| R17 | Implémenté : sauvegardes de configuration, restauration, corbeille et export/import des données personnelles. |
| R18 | Implémenté : curseur de nettoyage au-delà des mille premières clés. |
| R19 | Implémenté : capacité/rétention exposées et favoris exportables ; les limites de 800 publications/60 jours du flux restent effectives. |
| R20 | Avancé : pause globale, pause flux/sociale, planification RSS, retard de collecte et ancienneté des publications distingués. |
| F01 | Centre d’incidents et historique des collectes. |
| F02 | Alertes dans l’application et notifications explicitement activées ; pas de push serveur navigateur fermé. |
| F03 | Liste privée de surveillance et correspondances. |
| F04 | Notes, tags, lecture et favoris durables. |
| F05 | Briefing local exportable sans dépendance IA. |
| F06 | Import de sources JSON/OPML validé ; confirmation du nombre avant application. |
| F07 | Profils sociaux, priorité, activation et horaires administrables. |
| F08 | Sauvegardes versionnées et corbeille. |
| F09 | Dossiers avec copies de publications et chronologie ; les sources restent à recouper. |
| F10 | Couverture par source et par profil au prochain import achevé. |
| F11 | Vue mobile, catalogue public différé et copie privée hors ligne chiffrée choisie. |
| F12 | Synchronisation privée par identité vérifiée et gestion des conflits. |
| F13 | Trois rôles contrôlés côté serveur. |
| F14 | Configuration staging isolée et workflow de déploiement/rollback fournis ; environnement distant non créé sans identifiants Cloudflare. |

## Exploitation Cloudflare / GitHub

### Identités et droits

`ADMIN_EMAILS` accepte les adresses propriétaires séparées par une virgule. En l’absence de cette variable, le propriétaire déjà identifié dans cette application reste l’administrateur par défaut. Un code propriétaire valide reste administrateur pour la récupération. Les autres membres Cloudflare sont lecteurs jusqu’à attribution d’un rôle. Ne jamais copier de JWT, cookie de session ou clé API dans un ticket ou dans le dépôt.

### Clés de vérification Access

`scripts/refresh-access-jwks.mjs` n’accepte que l’émetteur officiel épinglé et ne récupère que des clés RSA publiques. Le workflow `access-keys.yml` renouvelle le secours quotidiennement via une PR limitée à ce fichier, puis attend les vrais tests avant fusion. Voir [la correction du 21 octobre](CORRECTIONS-2026-10-21.md) et [le fonctionnement de la rotation](ACCESS-KEY-ROTATION.md). Vérifier la première exécution GitHub et la propagation du déploiement : en cas de panne du workflow ou du déploiement, le secours expire toujours après sept jours. Il ne remplace pas la résolution du problème réseau entre le Worker et le JWKS.

### Préproduction

Le workflow manuel **Préproduction et retour de version** utilise les environnements GitHub `staging` et `production`. Ajouter dans ces environnements les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`, avec les droits nécessaires au Worker concerné. Les secrets ne sont pas écrits par ce changement.

Le Worker `cyberveille-fr-staging` a son propre namespace Durable Object, aucune collecte planifiée, les appels externes suspendus et les confirmations de gratuité désactivées. `workers_dev` est désactivé : configurer un domaine protégé par Cloudflare Access avant d’ouvrir la préproduction. N’y copier aucune clé fournisseur de production. Ajouter ses secrets d’accès séparément si une recette privée est souhaitée.

Pour revenir à une version, identifier d’abord une version Cloudflare connue, lancer `rollback-production` avec son identifiant, puis vérifier l’interface et les diagnostics. Ce retour ne restaure pas les données : utiliser les sauvegardes administratives pour la configuration. Après un rollback, annuler également le changement Git à l’origine de l’incident pour éviter que le prochain déploiement le réintroduise.

### Recette fournisseur réelle restante

1. Vérifier le hash/version après le déploiement, et un passage effectif du cron dans Opérations.
2. Contrôler une collecte X et une LinkedIn dans Bright Data : profils demandés, date minimale envoyée, snapshot, dernière publication publique connue et résultats reçus.
3. Vérifier les dépenses, la recharge automatique et les conditions gratuites dans le compte Bright Data ; les plafonds locaux ne remplacent pas la politique du fournisseur.
4. Vérifier un JWT Cloudflare récent depuis le navigateur et contrôler `keySource`. L’objectif demeure un JWKS distant fonctionnel.

## Validation reproductible

```
npm ci
npm test
npm run build
npm run test:runtime
npm run test:browser
```

Le runtime local fourni par la dépendance workerd supporte la date de compatibilité 2026-08-06 ; la configuration de production conserve 2026-09-01. Les tests locaux ne valident donc pas les éventuelles différences propres à cette dernière date. Chromium est installé par la CI ; en local, `/usr/bin/chromium` est utilisé s’il existe.

Les tests runtime n’appellent aucun fournisseur : ils vérifient l’autorisation, les transactions SQLite, les conflits de révisions, les sauvegardes, la persistance des favoris, la synchronisation et l’arrêt des flux. Le navigateur teste l’espace personnel et les onglets administratifs sur un écran 390 × 844, sans erreur JavaScript.
