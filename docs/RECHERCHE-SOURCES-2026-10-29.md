# Recherche des sources — version 2026-11-02.1

Dans **Administration → Ajouter une source**, trois boutons visibles permettent de choisir **Site internet**, **X / Twitter** ou **LinkedIn**. Le bouton sélectionné et le libellé de recherche indiquent le type actif. Le formulaire place le curseur dans la recherche. Un `@compte` ou une adresse sociale explicite sélectionne automatiquement la plateforme correspondante.

À partir de deux caractères, les correspondances du catalogue et les adresses explicites apparaissent immédiatement. La recherche Web complète la liste après une pause de 400 ms, sans effacer ces propositions si le moteur est indisponible. Les suggestions peuvent être parcourues avec les flèches et sélectionnées avec Entrée ; Échap ferme la liste. Chaque résultat indique sa plateforme et distingue catalogue, résultat indexé et adresse proposée non vérifiée.

Les suggestions combinent le catalogue existant et les résultats publics DuckDuckGo. Une adresse reconnue ou un `@identifiant` X est proposé directement, sans recherche Web. Un mot qui respecte la forme d’un identifiant X peut aussi proposer une adresse non vérifiée, tout en poursuivant la recherche par nom. Cela ne prouve pas que le compte existe : la vérification reste distincte. Les termes recherchés par nom sont transmis au moteur public ; les clés, identifiants et paramètres secrets dans une adresse sont refusés. Une protection du moteur peut limiter les résultats : le catalogue et les adresses directes restent utilisables.

## Sélection et vérification

- **Site internet** : la sélection lit la page, cherche les flux RSS/Atom annoncés et contrôle leur format. Un flux direct est également accepté. Si plusieurs flux sont proposés, leur choix est explicite. Un site accessible sans flux détecté ne devient pas une source RSS confirmée ; son adresse de flux peut être complétée manuellement.
- **X / Twitter** : sélection d’un profil, extraction de son identifiant et vérification des métadonnées publiques disponibles.
- **LinkedIn** : sélection d’un profil personnel `/in/`, avec normalisation des adresses localisées vers `www.linkedin.com`. Les pages entreprise ne sont pas prises en charge par le collecteur actuel.

Une suggestion indexée n’est pas une vérification d’existence actuelle. Pour les réseaux sociaux, un HTTP 200 générique ne suffit pas : des métadonnées cohérentes avec le profil sont nécessaires. Les codes 403 et 429, les pages de connexion et les protections sont affichés comme non vérifiés. Un 404 est signalé séparément. Même des métadonnées vérifiées ne confirment pas que la collecte Bright Data fonctionne.

La sélection renseigne les champs du formulaire ; le nom reste modifiable. L’enregistrement reste une action distincte. Les doublons de comptes ou de flux sont refusés. L’ajout de profils sociaux exige le rôle administrateur ; les éditeurs peuvent gérer les sources de sites.

La même recherche est disponible dans le champ d’identifiant du formulaire et directement dans les champs X et LinkedIn de **Profils et budget**. Elle préserve les autres brouillons et les horaires saisis. Un changement de recherche invalide le statut précédent et les valeurs remplies automatiquement, pour éviter d’enregistrer l’ancien flux avec un nouveau site.

## Fonctionnement technique

`GET /api/source-search?platform=site|x|linkedin&q=…` renvoie au plus huit suggestions. `POST /api/source-search` avec `{ "platform": "site", "url": "https://…" }` vérifie la sélection. Les deux opérations exigent une session privée et le rôle éditeur ou administrateur. Les POST vérifient aussi l’origine. Elles ne modifient pas la configuration et ne lancent ni Gemini ni extraction Bright Data.

La recherche par nom est limitée à 120 caractères, les adresses à 2 048 caractères, avec un cache privé borné de 60 secondes (15 secondes pour une recherche partielle), 90 recherches et 20 vérifications par minute et par compte. La pause globale conserve les suggestions locales sans appel de découverte externe.

Les lectures ont un délai global de douze secondes, une limite de 300 Kio par réponse et trois redirections au maximum. Chaque adresse et chaque redirection est revalidée sans transmettre de cookies ou de jetons utilisateur. La lecture du site reste sur son domaine ; les flux annoncés peuvent aussi utiliser les trois domaines Feedburner déjà autorisés par le collecteur. Au plus trois flux sont examinés, avec deux lectures simultanées.

Le JavaScript et les styles de recherche sont chargés à l’ouverture de l’administration depuis un fichier versionné, avec le nonce de la politique CSP existante. Si ce chargement échoue, le bouton d’ajout reste désactivé avec une explication et la possibilité de réessayer en rouvrant l’administration. La page initiale reste sous son budget de 260 000 caractères.

## Correction Cloudflare et validation

Le test dans le véritable runtime workerd a identifié une cause des anciens échecs JWKS : `fetch(..., { redirect: 'error' })` lève une exception avant tout appel réseau dans un Worker. La récupération utilise maintenant `manual` et refuse les réponses hors 2xx, sans suivre de redirection. Les vérifications RSA, de signature, d’émetteur, d’audience et d’expiration restent appliquées. Les clés publiques de secours ont aussi été renouvelées depuis l’émetteur épinglé, avec leur fenêtre maximale de sept jours.

Les tests couvrent la recherche et les vérifications simulées, les restrictions d’adresses, les refus HTTP, les pauses et les droits. Les tests Chromium contrôlent aussi les réponses obsolètes, le clavier, les doublons, les brouillons et les changements de site. Une recette publique a retrouvé ZATAZ et le compte X du CERT-FR ; un captcha de recherche LinkedIn a été correctement signalé comme résultat partiel. Aucun appel de collecte sociale ou Gemini n’a été utilisé pour cette recette.

La correction du 2 novembre ajoute des scénarios avec le véritable endpoint local : préfixe de nom du catalogue, préfixe `@`, identifiant complet et recherche dans le champ d’identifiant. Des scénarios distincts couvrent le serveur de recherche en HTTP 503, le fichier JavaScript indisponible puis rechargé, et une vérification obsolète dans le champ concurrent. Une recette publique par nom a retrouvé les profils X de Clément Domingo et CERT-FR ; ces résultats restent indexés et non confirmés par la collecte.
