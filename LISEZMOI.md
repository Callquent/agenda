# Agenda (Next.js + Prisma + SQLite)

Un agenda mensuel qui **rassemble les dates de vos autres applications**. Quand on lie une application
(Mes plantes, Tâches ménagères…), ses dates s'ajoutent à l'agenda et restent à jour ; quand on la délie,
elles disparaissent. On peut aussi y créer ses propres événements.

## Installer dans « MaPetiteBoîte »
1. Importez `agenda.zip` (identifiant **agenda**), puis, **dans le même temps, réimportez `plantes.zip` et
   `taches.zip`** : ce sont vos applications avec un fichier de plus (`/api/agenda`). Leurs données sont conservées.
2. Ouvrez l'agenda > **Applications liées** > **Lier une application**.
   L'agenda retrouve tout seul « MaPetiteBoîte » (ports 8080 à 8089). Si le port est inhabituel, définissez `HUB_URL`.

## Page « Liens » de MaPetiteBoîte
L'agenda expose `GET /api/liens` : la liste des applications qui lui fournissent leurs dates. L'onglet **Liens** de MaPetiteBoîte
l'affiche (schéma animé et détail « reçoit des données de… »).

## Lancer seul (développement)
    npm install
    npx prisma db push
    npm run dev          # http://localhost:3000

## Lier une autre application plus tard
L'application ajoute une route `GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` qui répond :

    { "events": [ { "id": "unique-par-occurrence", "title": "Arrosage : Ficus", "date": "2026-11-20",
                    "endDate": "2026-11-22",   // facultatif
                    "time": "18:30",           // facultatif
                    "status": "todo",          // todo | done | late
                    "category": "Arrosage",    // facultatif
                    "path": "/plantes/abc" } ] }   // lien dans l'application, facultatif

Puis, dans l'agenda : « Lier une application > Autre application » avec son identifiant (ou son adresse complète).
Exemples complets : `plantes/lib/agenda-feed.ts` et `taches/lib/agenda-feed.ts` (fonctions pures, testables).

## Événements répétés
Dans « Ajouter un événement » : **Une fois**, **Tous les X jours** ou **Jours de la semaine** (lundis, mardis…), à partir de la date choisie,
avec une date de fin facultative. Le bouton **Modifier** d'un événement rouvre le même formulaire (titre, date, heure, notes, couleur, répétition) ; pour une série, la modification vaut pour toute la série. Les occurrences sont calculées à l'affichage ; « Fait » se coche jour par jour, « Supprimer la série » retire tout.
Les notifications du jour tiennent compte des événements répétés.

## Comment ça marche
- Les dates importées sont **recopiées dans la base de l'agenda** (table `Event`, `sourceId` renseigné) pour la plage affichée
  et rafraîchies à l'ouverture d'un mois (au plus une fois par minute) ou avec « Synchroniser ».
- Une application injoignable n'efface rien : l'erreur s'affiche et les dernières dates connues restent visibles.
- Ce qui vient d'une autre application est revalidé champ par champ ; seuls les liens internes (`/chemin`) sont conservés.
- Les événements importés se modifient **dans leur application** ; ceux créés dans l'agenda se modifient dans l'agenda.

## Notifications du téléphone (sans application)
Page **Notifications** : une fois par jour, à l'heure choisie, l'agenda envoie la liste des tâches du jour (à faire et en retard)
sous forme de **notification du navigateur** (Web Push). Rien n'est envoyé si la journée est vide.
- Une fois par téléphone : **HTTPS** est nécessaire. « MaPetiteBoîte » le propose déjà : installer son certificat
  (page « Copie sur le téléphone », ouverte depuis le téléphone), puis ouvrir `https://<adresse du PC>:<port>/apps/agenda/notifications`
  et toucher « Activer les notifications ici ». Sur iPhone : iOS 16.4 minimum et agenda ajouté à l'écran d'accueil.
- Un minuteur interne (`instrumentation.ts` > `lib/scheduler.ts`) vérifie chaque minute ; si le PC était éteint à l'heure prévue,
  l'envoi part dès qu'il est rallumé, le même jour. « MaPetiteBoîte » doit donc être lancé (option « Démarrer avec l'ordinateur »).
- Le message passe par le service de notification du navigateur (Google, Mozilla, Apple, Microsoft), chiffré : le PC doit avoir internet.
- Les clés du serveur (VAPID) sont créées au premier usage et conservées dans la base ; `VAPID_SUBJECT` (mailto:…) est facultatif.
- Appareils : liste et retrait sur la même page ; un appareil désabonné par son navigateur est retiré automatiquement.
