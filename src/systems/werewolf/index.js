const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const Game = require('./Game');

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

    endGame(channelId) {
        const game = this.games.get(channelId);
        if (game) {
            // Nettoyage de la map des joueurs pour cette partie
            for (const playerId of game.players.keys()) {
                this.playerGames.delete(playerId);
            }
        }
        this.games.delete(channelId);
    }
}

module.exports = WerewolfManager;
