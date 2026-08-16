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
                const game = new Game(this.client, channel, host, this, data.themeId || 'default');

                // Restore state
                game.state = data.state;
                game.phase = data.phase || 'NIGHT';
                game.turn = data.turn || 1;
                game.logs = data.logs || [];
                game.recentDeadIds = data.recentDeadIds || [];
                game.customRoles = data.customRoles || [];
                game.pendingHunter = data.pendingHunter || false;
                game.dayPending = data.dayPending || false;
                game.isWolfUnanimous = data.isWolfUnanimous || false;
                game.mayorId = data.mayorId || null;

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
                    
                    if (pData.roleId) {
                        player.role = game.createRoleInstance(pData.roleId);
                        if (pData.roleState) {
                            Object.assign(player.role, pData.roleState);
                        }
                    }
                    
                    player.isAlive = pData.isAlive;
                    player.isProtected = pData.isProtected;
                    player.isInfected = pData.isInfected;
                    player.lover = pData.lover || null;
                    player.isMayor = pData.isMayor || false;
                    player.powerless = pData.powerless || false;

                    game.players.set(pData.id, player);
                    this.joinGame(pData.id, channel.id);
                }

                // Restore playerThreads
                if (data.playerThreads) {
                    const activeThreads = await channel.threads.fetchActive().catch(() => ({ threads: new Collection() }));
                    const archivedThreads = await channel.threads.fetchArchived().catch(() => ({ threads: new Collection() }));
                    
                    for (const [playerId, threadId] of Object.entries(data.playerThreads)) {
                        if (threadId) {
                            let thread = activeThreads.threads.get(threadId) || archivedThreads.threads.get(threadId);
                            if (!thread) {
                                thread = await channel.threads.fetch(threadId).catch(() => null);
                            }
                            if (thread) {
                                game.playerThreads.set(playerId, thread);
                            }
                        }
                    }
                }

                // Restore nightActions
                const nightActions = {
                    wolfVotes: new Map(),
                    wolfTargetId: data.nightActions?.wolfTargetId || null,
                    seerTargetId: data.nightActions?.seerTargetId || null,
                    witchActions: data.nightActions?.witchActions || { save: null, kill: null, skip: false },
                    guardTargetId: data.nightActions?.guardTargetId || null,
                    cupidTargets: data.nightActions?.cupidTargets || [],
                    whiteWolfTargetId: data.nightActions?.whiteWolfTargetId || null,
                    crowTargetId: data.nightActions?.crowTargetId || null,
                    blackWolfInfectedId: data.nightActions?.blackWolfInfectedId || null,
                    pyroGasTargetIds: data.nightActions?.pyroGasTargetIds || [],
                    pyroAction: data.nightActions?.pyroAction || null,
                };
                if (data.nightActions?.wolfVotes) {
                    for (const [voterId, targetId] of Object.entries(data.nightActions.wolfVotes)) {
                        nightActions.wolfVotes.set(voterId, targetId);
                    }
                }
                game.nightActions = nightActions;

                this.games.set(channel.id, game);
                console.log(`[Werewolf] Game fully restored in channel ${channel.id} (${game.players.size} players)`);

                // Resume active timers if any
                if (data.timerEnd) {
                    const timerEnd = data.timerEnd.toDate ? data.timerEnd.toDate().getTime() : data.timerEnd;
                    const timeLeft = timerEnd - Date.now();
                    if (timeLeft > 0) {
                        await game.resumeTimer(timeLeft);
                    } else {
                        console.log(`[Werewolf] Timer for game ${channel.id} expired while offline. Resolving phase now.`);
                        await game.resumeTimer(1000); // Trigger callback quickly
                    }
                }
            } catch (err) {
                console.error(`[Werewolf] Failed to restore game ${doc.id}:`, err);
            }
        }
    }
}

module.exports = WerewolfManager;
