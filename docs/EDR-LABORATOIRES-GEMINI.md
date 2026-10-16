# Parcours EDR, montage des laboratoires et Gemini — 2026-10-16.26

## Comprendre les captures et les indicateurs

Les captures à zéro avec un délai dépassé montrent un chargement interrompu, pas des alertes ni une absence de menaces. L’interface affiche maintenant « — » avant réception des données et propose une explication des indicateurs. Les nombres portent sur les publications collectées et leur dernier état ; le score n’est pas une mesure du risque du poste.

## Deux nouveaux parcours

Cortex XDR : six leçons, niveaux 1/1/2/2/3/3, de l’architecture et la licence à l’installation, prévention, XQL, triage/réponse puis exploitation et retrait. Defender : six leçons sur Antivirus/MDE/XDR, référence et analyse locale, onboarding, EICAR et journaux, Advanced Hunting/KQL, réponse et déploiement pilote ASR.

Les 12 nouvelles leçons comprennent notions, mécanismes, préparation, manipulations, résultats attendus, interprétation, dépannage, exercice et corrigé. Les manipulations utilisent uniquement un laboratoire et des actions bénignes. Les fonctions réelles de Cortex et MDE nécessitent un tenant, des rôles et une licence adaptés. Le mode documentaire fictif n’est jamais présenté comme une exécution réelle. Le test EICAR ne valide pas un EDR complet ; son contenu n’est pas embarqué dans l’application. Les VM Cortex et Defender sont séparées et la coexistence des protections doit être vérifiée dans la documentation de la version.

Références principales :
- https://cortex-docs.paloaltonetworks.com/cortex/cortex-xdr
- https://learn.microsoft.com/fr-fr/defender-endpoint/
- https://learn.microsoft.com/fr-fr/defender-endpoint/configure-endpoints-script
- https://www.eicar.org/download-anti-malware-testfile/

## Montage pour les 42 leçons

Chaque leçon possède désormais « Monter le laboratoire · étape par étape » : mode, prérequis, téléchargements, dossier de travail, topologie, réseau, préparation des données, commandes par système, contrôles de départ, preuves et remise en état. Les 36 fiches de ressources restent disponibles sans IA.

Les petits exercices restent locaux ou documentaires ; une VM n’est pas imposée à une simple matrice d’audit. Les laboratoires EDR expliquent création/vérification de la VM, ISO et disque virtuel, ressources indicatives, UEFI/TPM selon prérequis, NAT, nom du poste, mises à jour, snapshot avant onboarding, vérifications d’accès et procédure de retrait. Les laboratoires Web rappellent que 127.0.0.1 désigne le système où le serveur tourne : navigateur et capture doivent se trouver au bon endroit. La mémoire, le PCAP, l’ISO et l’image disque ont des rôles distincts.

Le montage complet et les instructions d’installation sont inclus dans le contexte du tutorat et dans la copie vers Gemini. La progression existante reste liée aux mêmes identifiants de leçon. Les nouvelles leçons sont ajoutées sans remplacer les anciennes.

## Gemini : solution recommandée pour la pile actuelle

1. API Gemini sur un modèle rapide pris en charge pour les petits travaux intégrés, avec cache et limites existantes.
2. Mode équilibré : traductions de fond dans le fil ; pause dans les parcours et diagnostics ; les demandes humaines de cet onglet attendent la fin d’un appel déjà envoyé puis passent avant les nouveaux travaux de fond.
3. Mode à la demande : aucune traduction automatique de fond, quota réservé aux questions et analyses. Choix conservé sur l’appareil. Le bouton explicite de relance des traductions réactive le mode équilibré.
4. Réponse de tutorat identique réutilisable pendant au plus 30 minutes si même leçon complète, question et dialogue, même modèle et identité de clé/propriétaire. Cache mémoire borné à l’instance Worker, susceptible d’éviction ou de perte au redémarrage. Aucune réponse d’erreur n’est cachée comme un succès.
5. Compte Gemini Pro dans le navigateur pour les cours et analyses longs : copie manuelle du contexte, puis collage. Pour la traduction, copie/import de lots existant. Cela ne consomme pas le quota API de Cyberveille, mais le compte Gemini possède ses propres limites d’usage.
6. Dans AI Studio, vérifier le projet, le modèle actif et les quotas effectivement disponibles. Un modèle Flash/Flash-Lite peut être étudié pour la latence, sans supposer qu’un quota gratuit est accordé. Aucun changement de modèle ou de facturation n’est fait automatiquement. Les paramètres de réflexion désactivée sont envoyés seulement aux modèles Flash 2.5 compatibles, sans imposer cette option à Pro ou à une famille différente.

Pour une automatisation avec une connexion Google compatible plutôt que la clé API classique, Gemini CLI est une architecture possible avec un PC/serveur privé disponible et un relais authentifié. Ses quotas sont distincts et ses conditions doivent être vérifiées. Cette liaison n’est pas installée ; le Worker ne peut pas lancer un exécutable CLI. Le service devrait être isolé, sans outils de fichiers ou commandes déclenchables par le contenu des articles ; aucun cookie du site Gemini n’est récupéré.

Documentation officielle :
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/thinking
- https://geminicli.com/docs/get-started/authentication/
- https://geminicli.com/docs/quota-and-pricing/

L’application ne peut pas garantir le quota réel du projet ni renouveler un quota épuisé. Aucun basculement payant, nouvel achat, contournement de quota ou automatisation du navigateur Gemini n’est activé.

## Validation

142 tests réussis et build valide : intégration des 12 leçons, montage des 42 laboratoires, contexte de copie complet, pause des traductions, priorité sans double appel, cache distinguant question/historique, options de modèle compatibles et suite de sécurité existante. Recette Chromium bureau et 390 px : six leçons par nouveau parcours, ouverture des montages, preuves de copie, choix du mode IA, tutorat simulé, conservation du volet ouvert, absence de traduction pendant le cours, aucun débordement ni erreur JavaScript. Les tests fournisseurs sont simulés ; les produits EDR réels et la session privée du tenant ne sont pas disponibles dans cet environnement.
