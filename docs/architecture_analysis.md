# Rapport d'Analyse: Cyberveille-fr

Conformément à la première mission d'analyse et de prise en main, voici le rapport détaillé sur l'architecture, le fonctionnement et l'état actuel de l'application `cyberveille-fr`.

## 1. Architecture Existante du Dépôt

L'application est structurée de la manière suivante :
*   **`.github/` / `audit/` / `docs/`**: Documentation et logs de sécurité.
*   **`scripts/`**: Scripts utilitaires Node.js (`dev.mjs`, `test.mjs`, `build.sh`) utilisés pour le développement local et les tests.
*   **`worker/`**: Contient le code source principal de l'application Cloudflare Worker. La quasi-totalité de l'application est contenue dans un fichier monolithique (`worker/index.js`), qui inclut à la fois la logique backend et le code frontend (HTML, CSS, JS injectés sous forme de chaînes de caractères).
*   **Configuration**: Fichiers classiques Node.js (`package.json`) et spécifiques à Cloudflare (`wrangler.jsonc`).

## 2. Framework, Langages, Bibliothèques et Dépendances

*   **Langages**: JavaScript (ECMAScript Modules - ESM), HTML5, CSS3.
*   **Framework**: Aucun framework frontend lourd (comme React ou Vue) ou backend (comme Express) n'est utilisé. L'application est écrite en **Vanilla JavaScript**.
*   **Dépendances Externes (NPM)**: Le projet est conçu pour être extrêmement léger ("zéro dépendance"). Le fichier `package.json` ne liste aucune dépendance de production. Il utilise uniquement les modules natifs de Node.js (`node:test`, `node:assert`, `node:vm`, `node:http`) pour les scripts de développement et de test.
*   **Environnement d'exécution**: Cloudflare Workers.

## 3. Fonctionnement du Frontend et du Backend

Le fonctionnement est fortement couplé au sein de `worker/index.js` :
*   **Backend (Worker)**: Le script écoute les requêtes HTTP (via `fetch`). Il gère différentes routes API (ex: `/api/feed`, `/api/health`, `/api/explain`, `/api/social`). Il orchestre les appels aux API externes et interagit avec le stockage local (Durable Objects).
*   **Frontend**: L'interface utilisateur est servie par la route racine (`/`). Le code HTML, CSS, et le JavaScript côté client sont générés dynamiquement et renvoyés en tant que réponse texte par le Worker.
*   Le script JavaScript côté client gère la navigation (vues : dashboard, feed, saved, tutorials, sources), les interactions utilisateur (clics sur les boutons), et communique avec les routes `/api/*` du Worker.

## 4. API, Bases de Données et Services Externes

L'application agit comme un agrégateur et s'appuie fortement sur des services tiers :
*   **Bases de Données (Cloudflare Durable Objects)**: Utilise `SOCIAL_STORE` avec une classe SQLite intégrée (`SocialStore` via `migrations` dans `wrangler.jsonc`) pour stocker et dédoublonner les publications sociales de manière persistante.
*   **Stockage Client**: Utilisation intensive de `localStorage` (`cyberveille-learning-done`, `cyberveille-saved`, `cyberveille-imports`, `cyberveille-translations`) pour les préférences, favoris et caches locaux. `sessionStorage` est utilisé pour gérer la session active (`cyberveille-access`).
*   **Services Externes**:
    *   **Gemini API (Google AI)**: Fournisseur principal d'IA pour les traductions automatiques des flux internationaux et les explications techniques détaillées ("Tutorat").
    *   **Bright Data**: Service de web scraping utilisé pour extraire automatiquement les publications de X (Twitter) et LinkedIn, en respectant un budget gratuit strict (max 4000 requêtes/mois).
    *   **Flux RSS/XML/Atom**: L'application parse de nombreux flux publics (CISA, NVD, blogs techniques) recensés dans la constante `SOURCES`.
    *   **API Officielles**: API publiques CISA KEV et NVD CVE 2.0 pour l'intégration des vulnérabilités. GitHub API pour vérifier les versions des outils dans les tutoriels.

## 5. Configuration Cloudflare

La configuration est définie dans `wrangler.jsonc` :
*   `compatibility_date`: "2026-09-01".
*   `main`: Point d'entrée ciblant `worker/index.js`.
*   **Durable Objects & Migrations**: Déclaration de `SOCIAL_STORE` lié à la classe `SocialStore` et de la migration SQLite `social-v1`.
*   **Triggers / Crons**: Un déclencheur est configuré pour s'exécuter toutes les 15 minutes (`*/15 * * * *`) pour l'actualisation des données.
*   **Variables d'Environnement / Secrets**:
    *   Vars définies dans `wrangler.jsonc`: `GEMINI_FREE_TIER_CONFIRMED: "true"`, `BRIGHTDATA_FREE_ONLY_CONFIRMED: "true"`.
    *   Secrets (nécessaires dans l'interface Cloudflare, non commités): `BRIGHTDATA_TOKEN`, `GEMINI_API_KEY`, `APP_ACCESS_TOKEN`.
*   **Sécurité / Cloudflare Access**: Les routes sensibles (API) sont protégées. L'application vérifie la présence du jeton Access.

## 6. Fonctionnalités Existantes et Travaux Incomplets

*   **Fonctionnalités Clés**:
    *   **Dashboard**: Vue d'ensemble statistique des menaces et thématiques abordées.
    *   **Le Fil de Veille**: Agrégation d'articles, avec traduction automatique asynchrone et filtrage par thématique/source.
    *   **Tutoriels**: Parcours d'apprentissage interactifs avec des laboratoires fictifs, des outils et une intégration Gemini ("Copier le cours + ma question").
    *   **Sources / Diagnostic**: Suivi en temps réel de la santé de la collecte des flux et gestion des imports manuels (ex: LinkedIn).
*   **Travaux Incomplets / En cours**:
    *   Le code semble stable et très riche en fonctionnalités, mais le format monolithique indique que l'application a atteint une taille où le développement sous un seul fichier devient très difficile.
    *   Les traductions dépendent de limites d'API strictes (quotas Gemini gratuits), ce qui entraîne parfois des états d'attente.

## 7. Problèmes Techniques, de Sécurité et de Maintenance

*   **Maintenance (Le Problème Majeur)**: Le fichier `worker/index.js` est un monolithe massif (probablement plus de 1000 lignes avec des blocs HTML/CSS/JS minifiés de plusieurs centaines de lignes concaténés). Modifier le frontend nécessite de manipuler des chaînes de caractères complexes.
*   **Sécurité**: Le code fait preuve d'une grande attention à la sécurité (échappement des balises avec `esc()`, vérifications de l'origine, gestion stricte des URL des images pour éviter le tracking). L'authentification repose sur Cloudflare Access ou un jeton maître.
*   **Limitations techniques**: La dépendance à `localStorage` signifie que les favoris et la progression de l'apprentissage ne sont pas synchronisés entre différents appareils pour un même utilisateur.

## 8. Proposition de Plan pour la Suite du Développement

Puisqu'il s'agit de **poursuivre le développement sans recréer l'application ni supprimer de fonctionnalités**, la première phase technique doit être une réorganisation du code (Refactoring) pour faciliter la maintenance future.

**Phase 1 : Modularisation du Code (Refactoring sans altération de fonctionnalité)**
1.  **Séparation du Frontend et Backend** : Extraire les énormes chaînes de caractères HTML, CSS, et le JavaScript client (`render()`, gestionnaires d'événements) de `worker/index.js` vers des fichiers distincts (ex: `src/client/style.css`, `src/client/app.js`, `src/server/htmlTemplate.js`).
2.  **Modularisation du Backend** : Diviser la logique du Worker en modules ES (`src/api/routes.js`, `src/services/gemini.js`, `src/services/brightdata.js`, `src/utils/parser.js`).
3.  **Mise en place d'un processus de Build (bundler)** : Utiliser un outil natif (comme esbuild ou rollup) dans `scripts/build.sh` pour recompiler ces modules séparés vers le fichier final unique `dist/server/index.js` exigé par Cloudflare, sans ajouter de dépendances de production lourdes, préservant l'esprit "Vanilla" du projet.

**Phase 2 : Évolutions Fonctionnelles (à définir selon vos besoins ultérieurs)**
1.  Amélioration de la gestion des erreurs de l'API Gemini.
2.  Synchronisation éventuelle des favoris et de la progression via les Durable Objects au lieu du seul `localStorage`.

Ce rapport constitue l'état des lieux initial pour reprendre le développement sereinement.
