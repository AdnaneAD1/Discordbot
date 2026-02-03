const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const { db } = require('../../services/firebase');
const Game = require('./Game');
const Player = require('./Player');

class WerewolfManager {
    constructor(client) {
        this.client = client;
        this.games = new Collection(); // ChannelID -> GameInstance
        this.playerGames = new Map(); // UserID -> ChannelID
    }

    createGame(channel, host) {
        if (this.games.has(channel.id)) return null;

        const game = new Game(this.client, channel, host, this);
        this.games.set(channel.id, game);
        this.joinGame(host.id, channel.id);
        return game;
    }

    joinGame(userId, channelId) {
        this.playerGames.set(userId, channelId);
    }

    leaveGame(userId) {
        this.playerGames.delete(userId);
    }

    getGame(channelId) {
        return this.games.get(channelId);
    }

    getGameByPlayerId(userId) {
        const channelId = this.playerGames.get(userId);
        if (!channelId) return null;
        return this.games.get(channelId);
    }

    async endGame(channelId) {
        const game = this.games.get(channelId);
        if (game) {
            // Nettoyage de la map des joueurs pour cette partie
            for (const playerId of game.players.keys()) {
                this.playerGames.delete(playerId);
            }
            await game.deleteState();
        }
        this.games.delete(channelId);
    }

    async initGames() {
        console.log('[Werewolf] Checking for active games in DB...');
        const snapshot = await db.collection('werewolf_active_games').get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            try {
                const channel = await this.client.channels.fetch(data.channelId);
                if (!channel) continue;

                const host = await this.client.users.fetch(data.hostId);
                const game = new Game(this.client, channel, host, this);

                // Restore state
                game.state = data.state;
                game.phase = data.phase;
                game.turn = data.turn;

                if (data.threadId) {
                    game.thread = await channel.threads.fetch(data.threadId).catch(() => null);
                }
                if (data.wolfThreadId) {
                    game.wolfThread = await channel.threads.fetch(data.wolfThreadId).catch(() => null);
                }

                // Restore players
                for (const pData of data.players) {
                    const user = await this.client.users.fetch(pData.id).catch(() => ({ id: pData.id, username: pData.username }));
                    const player = new Player(user);
                    player.role = pData.roleId ? { id: pData.roleId } : null; // Basic role restoration
                    player.isAlive = pData.isAlive;
                    player.isProtected = pData.isProtected;
                    player.isInfected = pData.isInfected;
                    player.isLover = pData.isLover;
                    player.isMayor = pData.isMayor;

                    game.players.set(pData.id, player);
                    this.joinGame(pData.id, channel.id);
                }

                this.games.set(channel.id, game);
                console.log(`[Werewolf] Game restored in channel ${channel.id} (${game.players.size} players)`);

                // Note: Timers are lost, but players can still interact or host can stop/restart.
            } catch (err) {
                console.error(`[Werewolf] Failed to restore game ${doc.id}:`, err);
            }
        }
    }
}

module.exports = WerewolfManager;
