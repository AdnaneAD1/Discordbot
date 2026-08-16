# 🤖 Open Discord Bot

> **A full-featured, open-source, and 100% free community Discord bot.** Music, games, leveling & XP, auto-moderation, AI image generation, tickets, social notifications, and much more — without any premium limitations or paywalls.

[🇫🇷 Français](./README.md) • [🇬🇧 English](./README.en.md)

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration (.env)](#-configuration-env)
- [Commands](#-commands)
  - [Administration](#%EF%B8%8F-administration)
  - [Moderation](#%EF%B8%8F-moderation)
  - [Music](#-music)
  - [Werewolf (Game)](#-werewolf-lg)
  - [CODM & Leveling (XP)](#-codm--leveling-xp)
  - [Casino & Minigames](#-casino--minigames)
  - [AI & Fun](#-ai--fun)
  - [Tickets](#-tickets)
  - [Social Notifications](#-social-notifications)
- [Internal Systems](#%EF%B8%8F-internal-systems)
- [Project Architecture](#-project-architecture)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

| Category | Description |
|---|---|
| 🎵 **Music** | High-performance playback via Lavalink/Shoukaku, persistent queue on reboot, looping, playlists |
| 🎮 **Werewolf (LG)** | Social deduction board game (14+ roles) with persistent Firestore game sessions & resilient timers |
| 📈 **Leveling & XP** | Message activity tracking, customizable military ranks (CODM), Canvas graphical profile card |
| 🛡️ **AI Moderation** | Sentinel (Toxic-BERT NLP), anti-leetspeak filter, automated warnings, progressive timeout & bans |
| 🎨 **AI Images** | Prompt-to-image generation (Pollinations/HuggingFace), Cloudinary CDN hosting, community gallery |
| 🎟️ **Tickets** | Interactive support ticket system with styled HTML conversation transcripts sent via DM & log channels |
| 📢 **Notifications** | Live alerts for Twitch & TikTok, new video uploads for YouTube & TikTok with rich interactive embeds |
| 🎰 **Casino** | Blackjack (fair Fisher-Yates shuffle), Roulette, daily chip rewards, economy system, leaderboards |
| 🃏 **Minigames** | Connect 4, Tic-Tac-Toe, CODM community challenges |
| 🎁 **Giveaways** | Timed automated giveaways with multi-winner support |
| 👋 **Welcome System** | Customizable welcome/goodbye messages and automatic new member role assignment |

---

## 📦 Prerequisites

- **Node.js** v18 or higher
- **npm** v9+
- A **Firebase** project (Firestore native mode)
- A running **Lavalink** server (v4+) for music functionality
- A **Cloudinary** account (for permanent AI image CDN storage)
- A **Hugging Face** API token (for Sentinel AI toxic text detection)
- **Twitch Developer** credentials (for Twitch stream notifications)

---

## 🚀 Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/open-discord-bot.git
cd open-discord-bot/bot

# 2. Install dependencies
npm install

# 3. Create and populate your environment file
cp .env.example .env

# 4. Deploy slash commands to Discord
npm run deploy

# 5. Start the bot
npm start
```

---

## ⚙️ Configuration (.env)

Create a `.env` file in the `/bot` directory:

```env
# ─── Discord ────────────────────────────────────────────────────────────────
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_development_guild_id (optional, for instant local slash command registration)

# ─── Firebase ───────────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ─── Lavalink (Music) ───────────────────────────────────────────────────────
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_AUTH=your_lavalink_password
LAVALINK_SECURE=false

# ─── Cloudinary (AI Gallery) ────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Hugging Face (Sentinel AI) ─────────────────────────────────────────────
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxx

# ─── Twitch ─────────────────────────────────────────────────────────────────
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_ACCESS_TOKEN=your_twitch_access_token
```

---

## 💬 Commands

All interactions use Discord **Slash Commands** (`/`).

---

### ⚙️ Administration

| Command | Description | Options |
|---|---|---|
| `/setupconfig` | Configures global bot settings for the guild | `log_channel`, `welcome_channel`, `ticket_category`, `staff_role`, `xp_veteran`, `xp_elite`, `xp_legende` |
| `/setupserver` | Automatically builds and formats a complete server channel structure | — |
| `/setuptickets` | Spawns an interactive ticket creation panel in the selected channel | `channel` |
| `/addsocial` | Registers a Twitch, YouTube, or TikTok creator to monitor | `platform`, `username`, `channel` |
| `/addchips` | Admin command to grant casino chips to a member | `user`, `amount` |
| `/addchallenge` | Creates a new CODM server challenge | `name`, `description`, `reward` |
| `/validatechallenge` | Marks a challenge as completed and grants the reward | `user`, `challenge` |
| `/giveaway` | Starts a giveaway with countdown timer and automated winner selection | `prize`, `duration`, `winners`, `channel` |
| `/setwelcomechannel` | Sets the welcome announcements channel | `channel` |
| `/setgoodbyechannel` | Sets the departure announcements channel | `channel` |
| `/setruleschannel` | Sets the server rules channel | `channel` |
| `/setsentinelchannel` | Sets the Sentinel moderation log channel | `channel` |
| `/setdefaultrole` | Sets the auto-role assigned to newly joined members | `role` |
| `/welcome-setup` | Configures custom welcome text and banner image | `message`, `image` |
| `/fixwelcome` | Resets and fixes corrupted welcome configurations | — |
| `/force_tiktok` | Forces an immediate manual check for a specific TikTok account | `username` |

---

### 🛡️ Moderation

| Command | Description | Options |
|---|---|---|
| `/ban` | Permanently bans a member from the server | `user`, `reason` |
| `/kick` | Kicks a member from the server | `user`, `reason` |
| `/warn` | Issues an official warning (3 warns = 1h timeout, 5 warns = permanent ban) | `user`, `reason` |
| `/clean` | Bulk deletes a specified number of messages in the current channel | `amount` |

> **Automated Moderation**:
> - **Anti-Leetspeak Filter**: Detects prohibited words even when obscured (e.g. `b.a.d.w.o.r.d`, `b4dw0rd`).
> - **Sentinel AI**: Analyzes message toxicity via Hugging Face Toxic-BERT. Messages with a toxicity score > 85% are automatically deleted and penalize the sender with a warning.

---

### 🎵 Music

Powered by **Lavalink** & **Shoukaku**.

| Command | Description | Options |
|---|---|---|
| `/play` | Plays audio from YouTube, Spotify, or direct URL | `query` |
| `/playlist` | Loads and queues an entire playlist | `url` |
| `/pause` | Pauses or resumes playback | — |
| `/skip` | Skips to the next track | — |
| `/back` | Replays the previous track | — |
| `/stop` | Stops playback, clears the queue, and disconnects | — |
| `/queue` | Displays the current playlist queue | — |
| `/loop` | Toggles track or queue repeat modes | `mode` |

> **Queue Persistence**: The music playback queue is serialized into Firestore (`music_active_queues`). If the bot restarts, it automatically rejoins voice channels and resumes playback seamlessly.

---

### 🎮 Werewolf (`/lg`)

A complete social deduction board game designed for 6 to 18 players with private player threads and day/night cycles.

| Subcommand | Description |
|---|---|
| `/lg start` | Opens a new game lobby in the channel |
| `/lg join` | Joins an open lobby |
| `/lg stop` | Forces game termination (host/admin) |
| `/lg info` | Displays game rules and available roles |

**Available Roles**:

| Role | Team | Special Ability |
|---|---|---|
| 🐺 Werewolf | Wolves | Eliminates a villager each night |
| 🔮 Seer | Village | Inspects one player's role per night |
| 🧙 Witch | Village | 1 life potion + 1 death potion |
| 🏹 Hunter | Village | Eliminates any player upon dying |
| 🛡️ Guard | Village | Protects a selected player each night |
| 👶 Wild Child | Variable | Chooses a role model; turns into a Werewolf if the model dies |
| 🦊 Fox | Village | Sniffs a group of 3 players to detect nearby wolves |
| 💘 Cupid | Village | Binds two players in love |
| 🎭 Actor | Variable | Adopts abilities from selected players |
| 🗡️ Assassin | Wolves | Targets a specific player at the start |
| 📯 Dictator | Village | Can execute a coup d'état to force a single execution |
| 🌾 Villager | Village | Participates and votes during the Day |

> **Game Session Persistence**: Game states, roles, private thread mappings, and night decisions are saved to Firestore (`werewolf_active_games`). Active timers are resumed upon bot restart.

---

### 📈 CODM & Leveling (XP)

| Command | Description | Options |
|---|---|---|
| `/rank` | Displays an image rank card (avatar, XP progress bar, rank badge) | `user` (optional) |
| `/top` | Server-wide XP leaderboard | — |
| `/profile` | Detailed player profile | `user` (optional) |
| `/defi` | Lists available community challenges | — |

**Military Ranks**: Recruit ➔ Veteran ➔ Elite ➔ Legend *(XP thresholds customizable via `/setupconfig`)*

> **Database Optimization**: XP is buffered in memory and flushed in atomic batches (`db.batch()`) every 30 seconds, reducing Firebase Firestore write operations by more than 80%.

---

### 🎰 Casino & Minigames

| Command | Description | Options |
|---|---|---|
| `/blackjack` | Plays Blackjack against the dealer (fair Fisher-Yates deck shuffle) | `bet` |
| `/roulette` | Bets on Roulette (Red / Black / Number) | `bet`, `choice` |
| `/chips` | Displays your chip balance | `user` (optional) |
| `/daily` | Claims your free daily chip reward | — |
| `/casinotop` | High-roller wealth leaderboard | — |
| `/connect4` | Challenges another member to Connect 4 | `opponent` |
| `/tictactoe` | Challenges another member to Tic-Tac-Toe | `opponent` |

---

### 🎨 AI & Fun

| Command | Description | Options |
|---|---|---|
| `/imagine` | Generates an AI artwork from a prompt (stored permanently on Cloudinary CDN) | `prompt` |
| `/gallery` | Interactive paginated gallery of AI creations made in the guild | `user` (optional) |
| `/rules` | Displays guild rules embed | — |

---

### 🎟️ Tickets

1. Run `/setuptickets` to publish the interactive ticket panel.
2. Members click the button to generate a private ticket channel.
3. Upon closing the ticket:
   - A modern dark-themed **HTML transcript** is compiled with avatars, timestamps, and media attachments.
   - The transcript file is automatically forwarded to the log channel, the closing moderator, and the ticket owner via DM.

---

### 📢 Social Notifications

Configure monitored accounts using `/addsocial`. Background checks execute on an interval (90 to 180 seconds).

| Platform | Trigger | Notification Format |
|---|---|---|
| **Twitch** | Stream goes live | Purple embed with stream title, category, preview + `Watch Stream` button |
| **YouTube** | New video uploaded | Red embed with channel name, title, HD thumbnail + `Watch Video` button |
| **TikTok** | Live / 1-hour live reminder / New post | Pink embed with author details, media preview + `View Video` button |

---

## ⚙️ Internal Systems

- **Sentinel AI**: NLP model running `toxic-bert` on Hugging Face. Toxicity scores > 85% trigger instant message removal and warnings.
- **Write-Buffered Leveling**: XP accumulations are held in memory buffers and synced to Firestore periodically via batched writes.
- **Music Reconnection**: Stored voice sessions and queues are restored 5 seconds post-startup to allow Lavalink node handshakes.
- **Werewolf State Machine**: Complete game persistence with timer resumption based on timestamp differential calculation.

---

## 🏗️ Project Architecture

```
bot/
├── src/
│   ├── index.js                  # Main entry point & client event dispatcher
│   ├── api/server.js             # Express healthcheck server (/health)
│   ├── commands/
│   │   ├── admin/                # Server setup & administration commands
│   │   ├── codm/                 # Leveling, profiles, rank cards & challenges
│   │   ├── fun/                  # AI imagine, gallery, roulette, blackjack, minigames
│   │   ├── moderation/           # Ban, kick, warn, clean moderation suite
│   │   ├── music/                # Play, pause, skip, queue, loop controls
│   │   ├── tickets/              # Ticket system panel setup
│   │   └── utility/              # Help menu, rules & general tools
│   ├── events/handlers/          # Button, select menu & modal interaction routers
│   ├── services/
│   │   ├── firebase.js           # Firestore SDK initialization
│   │   ├── music.js              # Shoukaku / Lavalink player management & persistence
│   │   ├── cloudinary.js         # Cloudinary CDN image uploader
│   │   ├── notifications.js      # Twitch, YouTube & TikTok background monitors
│   │   └── subscriptions.js      # Access tier validator (all features unlocked)
│   ├── systems/
│   │   ├── casino.js             # Casino algorithms (Blackjack & Roulette)
│   │   ├── moderation.js         # Auto-moderation, bad-word filter & warning progression
│   │   ├── sentinel.js           # Hugging Face Toxic-BERT NLP client
│   │   ├── tickets.js            # Ticket lifecycle & HTML transcript generator
│   │   ├── xp.js                 # Memory-buffered leveling engine
│   │   └── werewolf/             # Full Werewolf game engine (roles, timers, states)
│   └── utils/contentFilter.js    # Leetspeak normalizer & content filter
├── deploy-commands.js            # REST slash command registration script
└── package.json
```

---

## 🤝 Contributing

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

> ⚠️ **Notice**: Under the terms of the GPL-3.0, any modified versions or derived works that are distributed or hosted **must also be open-sourced under the same GPL-3.0 license** with full source code made available.

```bash
# 1. Create a feature branch
git checkout -b feature/my-new-feature

# 2. Commit your changes
git commit -m "feat: add feature X"

# 3. Push to your fork and submit a Pull Request
git push origin feature/my-new-feature
```

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**.
See the [LICENSE](./LICENSE) file for the complete license text.

```
Open Discord Bot — Copyright (C) 2026
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

---

<div align="center"><sub>Made by me</sub></div>
