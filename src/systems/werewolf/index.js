const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const Game = require('./Game');

class WerewolfManager {
    constructor(client) {
        this.client = client;
        this.games = new Collection(); // ChannelID -> GameInstance
    }

    createGame(channel, host) {
        if (this.games.has(channel.id)) return null;

        const game = new Game(this.client, channel, host, this);
        this.games.set(channel.id, game);
        return game;
    }

    getGame(channelId) {
        return this.games.get(channelId);
    }

    getGameByPlayerId(userId) {
        for (const game of this.games.values()) {
            if (game.players.has(userId)) return game;
        }
        return null;
    }

    endGame(channelId) {
        this.games.delete(channelId);
    }
}

module.exports = WerewolfManager;
