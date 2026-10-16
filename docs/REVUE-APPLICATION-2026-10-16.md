# Revue de l’application et refonte — 2026-10-16.22

## Ce qui change

Cyberveille s’ouvre sur un cockpit interactif, avec une interface sombre, des accents cyan, violet et vert, une navigation adaptée au téléphone, des cartes plus lisibles et des fenêtres de lecture retravaillées. Les cinq destinations restent disponibles : Cockpit, Flux, Lectures, Parcours et Sources. Le numéro de version figure en pied de page.

Les graphiques utilisent uniquement les publications présentes dans la collecte chargée. Les captures de recette emploient des données de test, jamais présentées comme des incidents réels dans l’application publiée.

- Histogramme quotidien, période de 7 ou 30 jours ; chaque barre ouvre les articles du jour.
- Répartition des priorités ; chaque niveau filtre les articles correspondants.
- Carte des thèmes, y compris Microsoft, SOC et audit ; clic pour ouvrir le sujet.
- Classement des sources ; clic pour afficher leurs publications, même dans un dossier regroupant plusieurs sources.
- Briefing des trois informations au score le plus élevé ; ouverture directe du dossier.
- Santé des flux publics et disponibilité en français des titres et extraits.

Les compteurs généraux couvrent tout le fil chargé ; les graphiques indiquent leur propre période. Les dates absentes ou invalides sont exclues des graphiques temporels. Plusieurs sujets ou sources peuvent représenter le même dossier. Les scores automatiques servent à prioriser la lecture et ne mesurent pas le risque du système de l’utilisateur. Aucun compteur de victimes, carte géographique ou incident confirmé n’est inventé.

## Corrections fonctionnelles

1. Une erreur après réception des données n’est plus assimilée à une panne générale de collecte.
2. Une panne réseau conserve le dernier fil et ses articles ; les lots reçus avant l’échec d’un lot suivant sont conservés.
3. Les actualisations simultanées des flux sont évitées dans l’onglet.
4. Les erreurs HTTP de l’analyse affichent le diagnostic du serveur. Une page de connexion Cloudflare est reconnue avant décodage JSON. Une panne de transport invite à vérifier la connexion ou à recharger la session.
5. Les requêtes navigateur ont un délai maximal ; le bouton d’analyse se réactive après une erreur.
6. L’analyse exige une connexion privée avant l’appel. Elle ne déclenche plus une nouvelle collecte de tous les flux. La provenance et le recoupement réutilisent également le cache chargé, y compris le stockage persistant après un redémarrage du Worker.
7. Un dossier absent du cache d’analyse demande d’actualiser le fil plutôt que de lancer silencieusement une collecte générale.
8. Chaque dossier propose une demande d’analyse avec son titre, son extrait, ses publications et leurs liens, copiable vers Gemini. Un refus du presse-papiers ouvre le texte sélectionnable et tente la copie compatible avec les navigateurs anciens. Cette action ne consomme aucun appel API.
9. Le cockpit est affiché dès l’ouverture, avant la fin de la collecte, avec un état vide explicite et l’accès aux exemples fictifs.

## Vérifications

| Domaine | Résultat |
|---|---|
| Suite de non-régression et sécurité | 123 tests réussis |
| Construction du Worker | Artefact ESM valide |
| Navigateur Chromium, bureau 1440 px | Cockpit, dossiers, erreurs, cours et sources vérifiés, aucune erreur JavaScript |
| Navigateur Chromium, mobile 390 px | Pas de débordement horizontal ; cinq entrées de navigation visibles ; parcours lisibles |
| Interactions | Période 30 jours, sujet, source, priorité, suppression du filtre, favori et vue Lectures vérifiés |
| Analyse | Blocage explicite sans session, propagation d’une erreur de quota simulée, dossier de copie non vide avec liens et contexte |
| Continuité | Après échec réseau simulé, les 96 dossiers de test restent affichés |
| Protection | Tests existants de sessions, révocation, verrouillage, CSP, injection, redirections, tailles, quotas partagés et absence de basculement payant toujours réussis |
| Contenu | Catalogue, comptes suivis, cours, références, progression, traductions, médias et imports conservés |

Aucune dépendance de production n’a été ajoutée. Les graphiques sont calculés dans le navigateur, sans transfert de la veille à un service de statistiques externe. Aucun secret ni réglage de facturation n’a été modifié. Les essais fournisseurs utilisent des réponses simulées, sans consommer les crédits de l’utilisateur.

## Points qui dépendent encore des services externes

- **Gemini API** : la refonte ne renouvelle pas un quota épuisé et ne transforme pas l’abonnement Google AI Pro en quota API. Les erreurs réelles nécessitent toujours le contrôle du projet et de ses limites. La copie manuelle vers Gemini fonctionne indépendamment de l’API.
- **Traduction** : le cockpit compte les titres et extraits français ou traduits. Il ne garantit pas la traduction intégrale des pages originales. Le mode manuel par lots et les liens de lecture traduite restent disponibles.
- **Flux 403/404/429** : ils restent indiqués comme indisponibles ou à vérifier. Aucun contournement de protection ni faux statut vert n’a été ajouté.
- **LinkedIn/X** : les résultats restent dépendants de Bright Data et des profils publics ; la navigation du cockpit ne déclenche aucune extraction sociale supplémentaire.
- **Production privée** : sans session Cloudflare et secrets de l’utilisateur, la réponse authentifiée des fournisseurs n’est pas vérifiable depuis cet environnement. La recette Chromium ne remplace pas l’essai sur un iPhone physique.
- Les limites de sécurité résiduelles décrites dans `audit/CORRECTIONS-SECURITE-2026-10-15.md` demeurent applicables, notamment les jetons en sessionStorage et les réglages des comptes fournisseurs.
