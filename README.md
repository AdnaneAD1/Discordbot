# 🤖 Open Discord Bot

> **Un bot Discord communautaire open-source, complet et gratuit.** Musique, jeux, XP, modération automatique, génération d'images IA, tickets, notifications sociales et bien plus encore — sans aucune restriction premium.

[🇫🇷 Français](./README.md) • [🇬🇧 English](./README.en.md)

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration (.env)](#-configuration-env)
- [Commandes](#-commandes)
- [Systèmes Internes](#️-systèmes-internes)
- [Architecture](#-architecture-du-projet)
- [Contribuer](#-contribuer)
- [Licence](#-licence)

---

## ✨ Fonctionnalités

| Catégorie | Description |
|---|---|
| 🎵 **Musique** | Lecture YouTube/Spotify via Lavalink, file persistante, loop, skip, playlist |
| 🎮 **Loup-Garou** | Jeu de société complet (14+ rôles) avec sessions persistantes, timers résiliants |
| 📈 **Système XP** | Gain d'XP par message, grades CODM, rank card graphique Canvas |
| 🛡️ **Modération IA** | Sentinel (Toxic-BERT), anti-leetspeak, warn automatique, timeout/ban progressif |
| 🎨 **Images IA** | Génération via Pollinations/HuggingFace, hébergement Cloudinary, galerie communautaire |
| 🎟️ **Tickets** | Support avec transcripts HTML automatiques envoyés par DM |
| 📢 **Notifications** | Alertes live Twitch, vidéos YouTube, live/posts TikTok avec embeds riches |
| 🎰 **Casino** | Blackjack, Roulette, daily chips, économie de jetons, classement |
| 🃏 **Mini-jeux** | Puissance 4, Morpion (Tic-Tac-Toe), Défis CODM |
| 🎁 **Giveaways** | Concours avec timer et tirage automatique |
| 👋 **Bienvenue** | Messages de bienvenue/au revoir personnalisables, rôle automatique |

---

## 📦 Prérequis

- **Node.js** v18+
- Un compte **Firebase** (Firestore en mode natif)
- Un serveur **Lavalink** (pour la musique)
- Un compte **Cloudinary** (pour la galerie d'images IA)
- Un compte **Hugging Face** (pour Sentinel IA)
- Des credentials **Twitch API** (pour les notifications Twitch)

---

## 🚀 Installation

```bash
git clone https://github.com/ton-username/open-discord-bot.git
cd open-discord-bot/bot
npm install
cp .env.example .env   # Éditez .env avec vos clés
npm run deploy         # Déployer les commandes slash
npm start              # Lancer le bot
```

---

## ⚙️ Configuration (.env)

```env
# Discord
DISCORD_TOKEN=votre_token_discord
CLIENT_ID=votre_client_id_discord

# Firebase
FIREBASE_PROJECT_ID=votre_project_id
FIREBASE_CLIENT_EMAIL=votre_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Lavalink (Musique)
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_AUTH=yourpassword
LAVALINK_SECURE=false

# Cloudinary (Galerie IA)
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret

# Hugging Face (Sentinel IA)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxx

# Twitch
TWITCH_CLIENT_ID=votre_client_id_twitch
TWITCH_ACCESS_TOKEN=votre_access_token_twitch
```

---

## 💬 Commandes

### ⚙️ Administration

| Commande | Description |
|---|---|
| `/setupconfig` | Configure les paramètres du bot (logs, welcome, tickets, staff, XP) |
| `/setupserver` | Crée automatiquement une structure de salons complète |
| `/setuptickets` | Initialise le panel de tickets dans un salon |
| `/addsocial` | Ajoute un compte Twitch/YouTube/TikTok à surveiller |
| `/addchips` | Ajoute des jetons de casino à un membre |
| `/addchallenge` | Crée un défi CODM |
| `/validatechallenge` | Valide un défi complété |
| `/giveaway` | Lance un concours avec timer et tirage automatique |
| `/setwelcomechannel` | Définit le salon de bienvenue |
| `/setgoodbyechannel` | Définit le salon d'au revoir |
| `/setruleschannel` | Définit le salon des règles |
| `/setsentinelchannel` | Définit le salon de logs Sentinel |
| `/setdefaultrole` | Définit le rôle automatique des nouveaux membres |
| `/welcome-setup` | Configure le message de bienvenue |
| `/fixwelcome` | Corrige la configuration de bienvenue |
| `/force_tiktok` | Force une vérification TikTok immédiate |

### 🛡️ Modération

| Commande | Description |
|---|---|
| `/ban` | Bannit un membre |
| `/kick` | Expulse un membre |
| `/warn` | Avertit un membre (3 warns → timeout 1h, 5 warns → ban) |
| `/clean` | Supprime un nombre de messages |

> **Modération Automatique** : Le bot bloque les mots interdits (même en leetspeak `m.o.t` → `mot`) et les messages toxiques (Toxic-BERT > 85%).

### 🎵 Musique

Requiert un serveur **Lavalink**.

| Commande | Description |
|---|---|
| `/play` | Joue une musique (YouTube, Spotify, URL) |
| `/playlist` | Charge une playlist entière |
| `/pause` | Met en pause |
| `/skip` | Piste suivante |
| `/back` | Piste précédente |
| `/stop` | Arrête et vide la file |
| `/queue` | Affiche la file d'attente |
| `/loop` | Active/désactive la répétition |

> La file d'attente est persistante dans Firestore et reprend automatiquement après un redémarrage.

### 🎮 Loup-Garou (`/lg`)

Jeu de déduction sociale pour 6 à 18 joueurs.

| Sous-commande | Description |
|---|---|
| `/lg start` | Lance une partie |
| `/lg join` | Rejoint une partie |
| `/lg stop` | Force l'arrêt |
| `/lg info` | Affiche les rôles et règles |

**Rôles disponibles** :

| Rôle | Camp | Capacité |
|---|---|---|
| 🐺 Loup-Garou | Maléfique | Élimine un villageois chaque nuit |
| 🔮 Voyante | Village | Découvre le rôle d'un joueur par nuit |
| 🧙 Sorcière | Village | 1 potion de vie + 1 potion de mort |
| 🏹 Chasseur | Village | Élimine un joueur à sa mort |
| 🛡️ Protecteur | Village | Protège un joueur chaque nuit |
| 👶 Enfant Sauvage | Variable | Devient Loup si son modèle est éliminé |
| 🦊 Renard | Village | Détecte un loup parmi 3 joueurs |
| 💘 Cupidon | Village | Lie deux joueurs amoureusement |
| 🎭 Comédien | Variable | Imite le rôle d'un joueur |
| 🗡️ Assassin | Maléfique | Cible choisie en début de partie |
| 📯 Dictateur | Village | Peut forcer un vote d'élimination |
| 🌾 Villageois | Village | Vote lors du Jour |

> La partie est entièrement sauvegardée dans Firestore (rôles, timers, actions) et reprend après un redémarrage.

### 📈 CODM & XP

| Commande | Description |
|---|---|
| `/rank` | Carte de rang graphique (avatar, XP, grade, barre de progression) |
| `/top` | Classement XP du serveur |
| `/profile` | Profil complet d'un membre |
| `/defi` | Liste des défis CODM disponibles |

**Grades** (seuils configurables via `/setupconfig`) : Recrue → Vétéran → Élite → Légende

### 🎰 Casino

| Commande | Description |
|---|---|
| `/blackjack` | Joue au Blackjack (mélange Fisher-Yates équitable) |
| `/roulette` | Mise sur la roulette |
| `/chips` | Vérifie le solde de jetons |
| `/daily` | Bonus quotidien de jetons |
| `/casinotop` | Classement des plus riches |

### 🎨 Fun & IA

| Commande | Description |
|---|---|
| `/imagine` | Génère une image IA depuis un prompt (hébergée sur Cloudinary) |
| `/gallery` | Galerie paginée des images IA du serveur |
| `/rules` | Affiche les règles du serveur |
| `/tictactoe` | Défi Morpion contre un membre |
| `/connect4` | Défi Puissance 4 contre un membre |

### 🎟️ Tickets

Après `/setuptickets`, un bouton interactif est posté dans le salon. À la fermeture d'un ticket :
- Un transcript HTML complet est généré
- Envoyé dans le salon logs
- Envoyé en DM au modérateur
- Envoyé en DM au créateur du ticket

### 📢 Notifications Sociales

Configurées via `/addsocial`. Vérification toutes les 90–180 secondes.

| Plateforme | Déclencheur | Notification |
|---|---|---|
| Twitch | Live | Embed violet + bouton Regarder le live |
| YouTube | Nouvelle vidéo | Embed rouge avec miniature HD + bouton |
| TikTok | Live / Rappel 1h / Nouvelle vidéo | Embed rose avec détails + bouton |

---

## ⚙️ Systèmes Internes

### Sentinel IA
Analyse chaque message via Hugging Face (`toxic-bert`). Score > 85% → suppression immédiate + warn automatique.

### Write Buffering XP
L'XP est accumulée en mémoire et écrite par lots toutes les 30 secondes (`db.batch()`). Réduction de +80% des appels Firestore.

### Persistance Musique
Queue sauvegardée dans `music_active_queues` (Firestore). Reprise automatique au redémarrage (délai 5s pour Lavalink).

### Persistance Loup-Garou
État complet dans `werewolf_active_games` (Firestore). Timers recalculés via `timerEnd` au redémarrage.

---

## 🏗️ Architecture du Projet

```
bot/
├── src/
│   ├── index.js                  # Entrée principale
│   ├── api/server.js             # Serveur Express (route /health)
│   ├── commands/
│   │   ├── admin/                # Commandes admin
│   │   ├── codm/                 # XP & Grades
│   │   ├── fun/                  # Fun & IA
│   │   ├── moderation/           # Modération
│   │   ├── music/                # Musique
│   │   ├── tickets/              # Tickets
│   │   └── utility/              # Utilitaires
│   ├── events/handlers/          # Gestionnaires d'événements
│   ├── services/
│   │   ├── firebase.js           # Firestore
│   │   ├── music.js              # Shoukaku/Lavalink + persistance
│   │   ├── cloudinary.js         # CDN images
│   │   ├── notifications.js      # Twitch/YouTube/TikTok
│   │   └── subscriptions.js      # Accès (tout gratuit)
│   ├── systems/
│   │   ├── casino.js             # Blackjack, Roulette
│   │   ├── moderation.js         # Automod + warns
│   │   ├── sentinel.js           # IA toxicité
│   │   ├── tickets.js            # Tickets + transcripts
│   │   ├── xp.js                 # XP buffering
│   │   └── werewolf/             # Jeu Loup-Garou complet
│   └── utils/contentFilter.js    # Filtre leetspeak
├── deploy-commands.js
└── package.json
```

---

## 🤝 Contribuer

> ⚠️ Ce projet est sous **GPL-3.0**. Toute modification redistribuée **doit être publiée** sous la même licence avec le code source complet.

```bash
git checkout -b feature/ma-fonctionnalite
# ... vos modifications ...
git commit -m "feat: description"
git push origin feature/ma-fonctionnalite
# Ouvrir une Pull Request
```

---

## 📄 Licence

Ce projet est sous licence **GNU General Public License v3.0**.
Voir le fichier [LICENSE](./LICENSE) pour le texte complet.

```
Open Discord Bot — Copyright (C) 2026
Ce programme est un logiciel libre distribué sous GPL-3.0.
Toute redistribution ou modification doit conserver cette licence et
publier le code source des modifications.
```

---

<div align="center"><sub>Fait par moi</sub></div>
