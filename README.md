# TUVCB Service Diploma

Ce micro‑service NestJS assure la gestion des diplômes numériques et des demandes de diplômes. Il permet de créer des diplômes, de gérer leur état (délivré ou non), de recevoir des demandes de diplômes de la part des étudiants et de coordonner la signature et l’ancrage de ces demandes sur la blockchain via le service blockchain. Les contrôleurs exposent les routes pour les diplômes, les demandes et des indicateurs de performance (KPI).

## Fonctionnement général

Une demande de diplôme suit un flux de travail : un étudiant soumet une requête, les utilisateurs autorisés (inscripteurs ou administrateurs) la signent, puis, une fois toutes les signatures recueillies, la requête est marquée prête pour l’ancrage. L’ancrage consiste à enregistrer la preuve du diplôme sur la blockchain, ce qui est réalisé via l’API du service blockchain. Une fois l’ancrage effectué, la transaction est confirmée et la demande passe au statut `ANCHORED`. Les statuts possibles (`PENDING`, `APPROVED`, `REJECTED`, `READY_FOR_ANCHOR`, `ANCHORED`) sont définis dans l’entité `DiplomaRequest`.

Le service communique avec :

- **Service Auth** : pour récupérer l’adresse du portefeuille de l’utilisateur via l’environnement `AUTH_SERVICE_URL`.
- **Service Users** : pour récupérer les informations de l’utilisateur et vérifier ses rôles via `USERS_SERVICE_URL`.
- **Service Blockchain** : pour ancrer les diplômes via une transaction Ethereum (URL généralement `http://tuvcb-service-blockchain:3000` ou exposé par Traefik).

## Installation et configuration

1. **Prérequis :** Node 14 ou plus, pnpm/npm, et une base PostgreSQL.
2. **Clonage :** `git clone https://github.com/tek-up-vcb/tuvcb-service-diploma.git`.
3. **Variables d’environnement :** copiez `.env.example` en `.env` puis renseignez :

   | Variable                                                          | Description                                                             |
   | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
   | `PORT`                                                            | Port HTTP (défaut : 3004).                                              |
   | `NODE_ENV`                                                        | Environnement (`development` ou `production`).                          |
   | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Paramètres de connexion PostgreSQL et synchronisation (activée en dev). |
   | `AUTH_SERVICE_URL`                                                | URL du service Auth pour récupérer le portefeuille utilisateur.         |
   | `USERS_SERVICE_URL`                                               | URL du service Users pour obtenir les informations utilisateur.         |
   | `BLOCKCHAIN_SERVICE_URL`                                          | URL de l’API blockchain pour ancrer les diplômes.                       |
   | `JWT_SECRET`, `JWT_EXPIRES_IN`                                    | Clé et durée de validation des JWT servant à protéger certaines routes. |

4. **Installation des dépendances :** `pnpm install` ou `npm install`.
5. **Migrations :** en mode développement, TypeORM synchronise automatiquement la base. En production, appliquez vos migrations.
6. **Lancement :** `npm run start:dev`.

Dans l’orchestration Docker, ces variables sont définies dans `docker-compose.yml`; Traefik expose l’API via `http://app.localhost/api/diplomas`.

## API Diplomas

Les endpoints liés aux diplômes sont :

| Méthode & route         | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **POST** `/diplomas`    | Créer un nouveau diplôme (titre, étudiant, date, résumé).               |
| **GET** `/diplomas`     | Lister tous les diplômes filtrés par étudiant, par titre ou par statut. |
| **GET** `/diplomas/:id` | Obtenir le détail d’un diplôme particulier.                             |

## API Requests (demandes de diplômes)

Ces endpoints gèrent le cycle de vie des demandes :

| Méthode & route                                 | Description                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **POST** `/diplomas/requests`                   | Soumettre une nouvelle demande de diplôme. L’étudiant doit être authentifié; le service crée un enregistrement avec statut `PENDING`.                                                                              |
| **GET** `/diplomas/requests`                    | Lister les demandes existantes avec filtrage (par statut ou par étudiant).                                                                                                                                         |
| **GET** `/diplomas/requests/:id`                | Obtenir une demande par son identifiant.                                                                                                                                                                           |
| **PUT** `/diplomas/requests/:id/sign`           | Signer une demande. Les signataires autorisés (administrateurs ou responsables pédagogiques) ajoutent leur signature; lorsque toutes les signatures requises sont présentes, le statut passe à `READY_FOR_ANCHOR`. |
| **DELETE** `/diplomas/requests/:id`             | Supprimer une demande existante.                                                                                                                                                                                   |
| **PUT** `/diplomas/requests/:id/anchor-request` | Demander l’ancrage. Le service appelle le service blockchain pour enregistrer le diplôme et crée un batch ID.                                                                                                      |
| **PUT** `/diplomas/requests/:id/anchor-confirm` | Confirmer l’ancrage en enregistrant le hash de transaction et le résultat de la blockchain.                                                                                                                        |

## API KPIs

Afin de suivre l’avancement des délivrances, le service expose des endpoints de métriques :

| Méthode & route                            | Description                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **GET** `/diplomas/kpi/metrics/all`        | Renvoie des agrégats : nombre total de demandes, nombre en attente, prêtes pour l’ancrage, ancrées, etc. |
| **GET** `/diplomas/kpi/graduated-students` | Nombre total d’étudiants ayant obtenu un diplôme.                                                        |

## Conseils et bonnes pratiques

- **Signature et authentification** : toutes les routes liées à la création ou à la signature des diplômes nécessitent un JWT valide dans l’en‑tête `Authorization`. Assurez‑vous d’interroger le service Auth pour obtenir un token.
- **Coordination avec la blockchain** : l’ancrage est asynchrone ; utilisez les endpoints `anchor-request` et `anchor-confirm` pour gérer cet état. Le service `blockchain` doit être disponible et correctement configuré.
- **Synchronisation de base** : désactivez `synchronize` en production pour éviter de perdre des données et gérez les migrations explicitement.
- **Résolution DNS** : dans l’environnement local, ajoutez `127.0.0.1 app.localhost` dans votre `/etc/hosts` afin que `app.localhost` résolve vers votre machine pour la configuration Traefik.
