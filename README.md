# TP 1 – Azure Functions : Architecture Serverless Événementielle (Local)

Ce projet met en œuvre une architecture événementielle serverless complète exécutée localement sans compte cloud Azure, en s'appuyant sur le runtime **Azure Functions v4 (Node.js)** et l'émulateur **Azurite**.

---

## 1. Architecture globale

Le système implémente un découplage asynchrone strict basé sur les événements et les bindings natifs du runtime Azure :

```text
  [ Client HTTP / test.http ]
               │
               ▼  (POST JSON)
      ┌─────────────────┐
      │   httpTrigger   │  (Stateless Ingestion)
      └────────┬────────┘
               │  [ Output Binding: storageQueue ]
               ▼
       ┌───────────────┐
       │ Queue Storage │  (Queue: "orders")
       └───────┬───────┘
               │  [ Queue Trigger ]
               ▼
      ┌─────────────────┐
      │  queueTrigger   │  (Asynchronous Consumer)
      └────────┬────────┘
               │  [ Output Binding: table ]
               ▼
       ┌───────────────┐
       │ Table Storage │  (Table: "OrdersTable")
       └───────────────┘
               │
               ▼  (Inspection / Validation)
       [ readTable.js ]
```

---

## 2. Composants et rôle des fonctions

### `httpTrigger` (Ingestion)
- **Type de déclencheur** : HTTP (`POST`).
- **Rôle** : Point d'entrée de l'application. Reçoit le payload JSON, valide le corps de la requête et publie la charge utile dans la file de messages sans bloquer l'appelant.
- **Conception** : Fonction *stateless* conforme aux principes FaaS, sans dépendance directe avec la couche de persistance.
- **Communication** : Utilise l'output binding natif `output.storageQueue` pour déposer le message dans la file `orders`.

### `queueTrigger` (Traitement et Persistance)
- **Type de déclencheur** : Queue Storage (`orders`).
- **Rôle** : Worker asynchrone instancié automatiquement dès l'arrivée d'un message dans la file.
- **Traitement** : Désérialise la donnée, génère les clés de partitionnement et d'identification requises (`PartitionKey`, `RowKey`) et enrichit l'objet avec un horodatage ISO (`processedAt`).
- **Persistance** : Utilise l'output binding natif `output.table` pour insérer automatiquement l'entité dans `OrdersTable`.

---

## 3. Structure du projet

```text
tp1-azure-functions/
├── src/
│   └── functions/
│       ├── httpTrigger.js      # Fonction HTTP + Output binding Queue
│       └── queueTrigger.js     # Fonction Queue Trigger + Output binding Table
├── host.json                   # Configuration des bundles d'extensions Azure
├── local.settings.json         # Configuration et chaîne de connexion locale
├── package.json                # Dépendances Node.js
├── readTable.js                # Utilitaire CLI d'inspection du Table Storage
├── test.http                   # Fichier de requêtes HTTP intégrées (REST Client)
├── .gitignore                  # Exclusion des caches, logs et artefacts Azurite
└── README.md                   # Documentation technique de la solution
```

---

## 4. Prérequis

- **Node.js** : v18, v20 ou v22
- **Azure Functions Core Tools** : v4 (`func`)
- **Azurite** : Émulateur local de stockage Azure (Extension VS Code ou CLI)

---

## 5. Procédure de lancement pas à pas

### 1. Démarrer l'émulateur Azurite
Dans Visual Studio Code :
- Ouvrir la palette de commandes (`Ctrl + Shift + P`) puis exécuter `Azurite: Start`.
- Vérifier que les services sont actifs sur les ports par défaut :
  - **Blob Service** : `127.0.0.1:10000`
  - **Queue Service** : `127.0.0.1:10001`
  - **Table Service** : `127.0.0.1:10002`

### 2. Installer les dépendances
À la racine du projet, exécuter :
```bash
npm install
```

### 3. Vérifier la configuration locale (`local.settings.json`)
Le fichier doit pointer sur le stockage émulé :
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
```

### 4. Démarrer le runtime Azure Functions
Lancer la solution avec la commande :
```bash
func start
```
Le terminal confirme l'initialisation des deux workers :
- `httpTrigger: [POST] http://localhost:7071/api/httpTrigger`
- `queueTrigger: queueTrigger [storageQueue]`

---

## 6. Validation et exécution des tests

Deux méthodes permettent de tester le flux événementiel de bout en bout :

### Méthode 1 : Via le fichier de test intégré (`test.http`)
Ouvrir le fichier `test.http` dans VS Code (avec l'extension *REST Client*) et cliquer directement sur le lien **Send Request** au-dessus de la requête souhaitée :

```http
POST http://localhost:7071/api/httpTrigger
Content-Type: application/json

{
    "category": "Materiel",
    "produit": "Clavier",
    "prix": 49.99
}
```

### Méthode 2 : Via cURL
Exécuter la requête suivante dans un terminal :
```bash
curl -X POST http://localhost:7071/api/httpTrigger \
  -H "Content-Type: application/json" \
  -d '{"category":"Materiel", "produit":"Clavier", "prix":49.99}'
```

---

## 7. Vérification de la persistance des données

L'exécution s'observe à deux niveaux :

1. **Dans les logs d'exécution de `func start`** :
   - `httpTrigger` renvoie un statut `202 Accepted` et dépose le message dans la file.
   - `queueTrigger` consomme instantanément le message de la queue et persiste l'entité dans la table.

2. **Dans le stockage émulé via l'outil d'inspection** :
   Pour visualiser le contenu réel persisté dans `OrdersTable` sans dépendance logicielle externe, exécuter :
   ```bash
   node readTable.js
   ```
   Sortie type :
   ```text
   --- CONTENU DE LA TABLE OrdersTable DANS AZURITE ---
   [Ligne 1] PartitionKey: Materiel | RowKey: a8ba6be2-5848-4907-9931-e1fccffa878c
            Produit: Clavier | Prix: 49.99€ | Traité le: 2026-09-10T10:01:38.396Z
   ```

   ---

## 8. Analyse en couches techniques (Le "Mille-Feuille" FaaS)

Conformément à la décomposition architecturale du cloud computing (FaaS / Serverless), voici la répartition des responsabilités et l'analyse des points de fragilité de chaque couche :

| Couche technique | Composant dans la solution | Responsabilité (Équipe vs Cloud) | Points de fragilité identifiés |
| :--- | :--- | :--- | :--- |
| **Code applicatif** | `httpTrigger.js`, `queueTrigger.js` | **Équipe de développement** | Erreur de parsing du payload JSON, boucle infinie ou crash non géré. |
| **Configuration (Glue)** | `host.json`, Bindings natifs | **Équipe de développement** | Chaîne de connexion erronée, incohérence de version de bundle. |
| **Middleware & Message Broker** | Azure Queue Storage (Azurite) | **Fournisseur Cloud** (managé) | *Poison messages* (messages invalides bloquants), saturation du quota de file. |
| **Persistance / Stockage** | Azure Table Storage (Azurite) | **Fournisseur Cloud** (managé) | Mauvais choix de `PartitionKey` créant un goulet d'étranglement (*hot partition*). |
| **Environnement d'exécution** | Node.js v4 runtime (Functions Host) | **Fournisseur Cloud** (managé) | **Cold start** (latence d'instanciation à froid), fuite mémoire sur exécutions répétées. |
| **OS & Conteneur** | Conteneur anonyme instancié à la volée | **Fournisseur Cloud** | Timeout d'exécution imposé (10 min max), contrainte stricte de *statelessness*. |
| **Réseau & Infrastructure** | VNet, ports d'écoute, serveurs physiques | **Fournisseur Cloud** | Latence réseau inter-services, coûts du trafic sortant (*egress*), quotas régionaux. |

---

## 9. Analyse critique : Limites du modèle Serverless & Émulation locale

### Limites intrinsèques du Serverless
- **Cold start** : Lors d'un pic après une période d'inactivité, le fournisseur doit allouer un conteneur et démarrer le runtime Node.js, ce qui introduit une latence de plusieurs secondes sur le premier appel.
- **Statelessness** : Les fonctions ne partagent aucune mémoire persistante. Tout état doit transiter par un composant externe (Storage, Cache, BDD), ce qui reporte la pression de montée en charge sur la base de données.
- **Modèle de coût (FinOps)** : Très économique pour un usage sporadique ou par vagues (facturation à la milliseconde), le serverless devient significativement plus cher qu'une instance réservée (PaaS/IaaS) si la charge applicative est continue 24h/24.

### Émulation locale (Azurite) vs Exécution Cloud réelle
- **Comportement réseau** : En local sur `127.0.0.1`, la latence est quasi nulle. En production, les appels HTTP, Queue et Table traversent le réseau cloud (VNet/Internet) et génèrent latence et coûts réseau (*egress*).
- **Scalabilité et concurrence** : Azurite est un processus mono-machine qui traite les flux de manière séquentielle. En cloud réel, Azure Functions scale automatiquement horizontalement en instanciant des dizaines de workers en parallèle.
- **Résilience et quotas** : L'environnement local ne simule ni les throttlings (limites de requêtes/seconde imposées par Azure), ni les mécanismes de réplication multi-zones en cas de sinistre.