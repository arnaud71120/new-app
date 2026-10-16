# Utiliser Google AI Pro autrement que par la clé API

État au 16 octobre 2026 : Cyberveille propose l’API Gemini et la copie/importation
manuelle vers Gemini Pro. Aucune liaison Gemini CLI ou modèle local n’est active.

## 1. Gemini dans le navigateur — déjà utilisable

Les boutons de copie du cours et du lot de traduction préparent un prompt complet.
Le propriétaire le colle dans Gemini, puis peut réimporter le JSON de traduction.
Cela utilise les limites de l’application Gemini de son compte Google AI Pro et
ne consomme pas le quota de la clé API serveur. Il reste des limites d’utilisation.
Cyberveille ne lit pas les cookies ni les identifiants Google de l’utilisateur.

## 2. Gemini CLI — possibilité d’automatisation

L’outil officiel Gemini CLI permet une connexion avec le compte Google associé
à Google AI Pro et une exécution en mode sans interface, avec une réponse JSON.
La documentation décrit l’utilisation des identifiants préalablement enregistrés
pour ce mode. La documentation affiche actuellement 1 500 requêtes par jour pour
Google AI Pro ; la limite et les modèles disponibles peuvent évoluer. Ce n’est
pas un accès illimité ni le transfert de quota vers la clé API classique.

Architecture possible :

Cyberveille → service privé sur le PC/serveur du propriétaire → Gemini CLI → réponse.

Ce service n’existe pas encore. Le Worker Cloudflare ne peut pas lancer directement
l’exécutable CLI. Un PC, un mini-PC ou un serveur devrait rester allumé et accessible
par une liaison authentifiée. L’accès devrait rester réservé au propriétaire,
avec validation des requêtes, plafonds et délais. Les commandes et outils de
fichiers de l’agent CLI doivent être désactivés et le service isolé : les articles
à traduire sont des contenus non fiables, pas des consignes d’exécution.
Les identifiants OAuth restent sur cette machine, jamais dans le dépôt ou le
navigateur. Une configuration et une validation séparées sont nécessaires avant
une mise en service. Ne pas publier un endpoint CLI sans authentification.

## 3. Modèle local

Un modèle de traduction/LLM exécuté localement, par exemple via Ollama, évite les
quotas API d’un fournisseur. La puissance du matériel, la qualité de traduction,
la consommation électrique et la disponibilité du PC deviennent les limites.
Il faut également un service privé accessible à Cyberveille. Rien n’a été installé
ni exposé au réseau pour cette option.

Automatiser les clics du site Gemini serait dépendant des changements de page,
des sessions et des vérifications de connexion. Le mécanisme officiel CLI est
un meilleur candidat technique à étudier pour une automatisation personnelle.
Le fait de pouvoir automatiser le CLI ne constitue pas une garantie de service
ou de prise en charge de tout usage comme backend de production par Google.

## Sources officielles

- Authentification CLI : https://geminicli.com/docs/get-started/authentication/
- Mode automatisé : https://geminicli.com/docs/cli/headless/
- Quotas CLI : https://geminicli.com/docs/resources/quota-and-pricing/
- Conditions applicables : https://geminicli.com/docs/resources/tos-privacy/
- Quotas de l’application Gemini : https://support.google.com/gemini/answer/16275805
- Plans Google AI et API : https://ai.google.dev/gemini-api/docs/google-ai-plans
