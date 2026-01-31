/**
 * Système de statistiques de jeux
 * Structure extensible pour suivre les stats de différents jeux
 */

const { db } = require('../services/firebase');

// Types de jeux supportés
const GAME_TYPES = {
    WEREWOLF: 'werewolf',
    // Futurs jeux
    // BLACKJACK: 'blackjack',
    // ROULETTE: 'roulette',
    // QUIZ: 'quiz'
};

// Structure des statistiques par jeu
const STATS_SCHEMA = {
    [GAME_TYPES.WEREWOLF]: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        // Stats par rôle
        roleStats: {
            // roleId: { played: 0, wins: 0 }
        },
        // Stats par équipe
        teamStats: {
            village: { played: 0, wins: 0 },
            werewolf: { played: 0, wins: 0 },
            solo: { played: 0, wins: 0 }
        },
        // Autres stats
        killsAsWolf: 0,
        savedAsWitch: 0,
        correctSeerVisions: 0,
        mayorElections: 0,
        survivalStreak: 0,
        bestSurvivalStreak: 0,
        lastPlayed: null
    }
};

/**
 * Récupère les stats d'un utilisateur pour un jeu
 */
async function getGameStats(userId, guildId, gameType) {
    try {
        const statsRef = db.collection('guilds').doc(guildId)
            .collection('game_stats').doc(userId);
        const statsDoc = await statsRef.get();

        if (statsDoc.exists && statsDoc.data()[gameType]) {
            return statsDoc.data()[gameType];
        }

        // Retourner les stats par défaut
        return { ...STATS_SCHEMA[gameType] };
    } catch (error) {
        console.error('[GameStats] Erreur récupération:', error);
        return { ...STATS_SCHEMA[gameType] };
    }
}

/**
 * Met à jour les stats d'un utilisateur pour un jeu
 */
async function updateGameStats(userId, guildId, gameType, updates) {
    try {
        const statsRef = db.collection('guilds').doc(guildId)
            .collection('game_stats').doc(userId);

        await statsRef.set({
            [gameType]: updates,
            updatedAt: new Date()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('[GameStats] Erreur mise à jour:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Enregistre le résultat d'une partie de Loup-Garou
 */
async function recordWerewolfGame(guildId, players, winningTeam, gameData = {}) {
    const batch = db.batch();
    const now = new Date();

    for (const player of players) {
        const { id: playerId, role, team, isAlive } = player;
        const didWin = determineWerewolfWin(team, role, winningTeam, player);

        // Récupérer les stats actuelles
        const currentStats = await getGameStats(playerId, guildId, GAME_TYPES.WEREWOLF);

        // Mettre à jour les stats générales
        const newStats = {
            ...currentStats,
            gamesPlayed: (currentStats.gamesPlayed || 0) + 1,
            wins: (currentStats.wins || 0) + (didWin ? 1 : 0),
            losses: (currentStats.losses || 0) + (didWin ? 0 : 1),
            lastPlayed: now
        };

        // Mettre à jour les stats par rôle
        const roleId = role.id;
        if (!newStats.roleStats) newStats.roleStats = {};
        if (!newStats.roleStats[roleId]) {
            newStats.roleStats[roleId] = { played: 0, wins: 0 };
        }
        newStats.roleStats[roleId].played++;
        if (didWin) newStats.roleStats[roleId].wins++;

        // Mettre à jour les stats par équipe
        const teamKey = getTeamKey(team, role);
        if (!newStats.teamStats) {
            newStats.teamStats = {
                village: { played: 0, wins: 0 },
                werewolf: { played: 0, wins: 0 },
                solo: { played: 0, wins: 0 }
            };
        }
        if (!newStats.teamStats[teamKey]) {
            newStats.teamStats[teamKey] = { played: 0, wins: 0 };
        }
        newStats.teamStats[teamKey].played++;
        if (didWin) newStats.teamStats[teamKey].wins++;

        // Streak de survie
        if (isAlive) {
            newStats.survivalStreak = (newStats.survivalStreak || 0) + 1;
            if (newStats.survivalStreak > (newStats.bestSurvivalStreak || 0)) {
                newStats.bestSurvivalStreak = newStats.survivalStreak;
            }
        } else {
            newStats.survivalStreak = 0;
        }

        // Stats spécifiques aux rôles (si fournies)
        if (gameData.wolfKills && gameData.wolfKills[playerId]) {
            newStats.killsAsWolf = (newStats.killsAsWolf || 0) + gameData.wolfKills[playerId];
        }
        if (gameData.witchSaves && gameData.witchSaves[playerId]) {
            newStats.savedAsWitch = (newStats.savedAsWitch || 0) + gameData.witchSaves[playerId];
        }
        if (gameData.wasMayor && gameData.wasMayor.includes(playerId)) {
            newStats.mayorElections = (newStats.mayorElections || 0) + 1;
        }

        // Ajouter au batch
        const statsRef = db.collection('guilds').doc(guildId)
            .collection('game_stats').doc(playerId);
        batch.set(statsRef, {
            [GAME_TYPES.WEREWOLF]: newStats,
            updatedAt: now
        }, { merge: true });
    }

    await batch.commit();
    console.log(`[GameStats] Stats enregistrées pour ${players.length} joueurs`);
}

/**
 * Détermine si un joueur a gagné au Loup-Garou
 */
function determineWerewolfWin(team, role, winningTeam, player) {
    // Cas spéciaux
    if (role.id === 'white_werewolf' && winningTeam === 'white_werewolf') return true;
    if (role.id === 'pyromaniac' && winningTeam === 'pyromaniac') return true;

    // Couple
    if (player.lover && winningTeam === 'lovers') return true;

    // Équipes normales
    if (team === 'VILLAGE' && winningTeam === 'village') return true;
    if (team === 'WEREWOLF' && winningTeam === 'werewolf') return true;

    return false;
}

/**
 * Retourne la clé d'équipe pour les stats
 */
function getTeamKey(team, role) {
    if (role.id === 'white_werewolf' || role.id === 'pyromaniac') {
        return 'solo';
    }
    return team === 'WEREWOLF' ? 'werewolf' : 'village';
}

/**
 * Récupère le classement d'un jeu
 */
async function getLeaderboard(guildId, gameType, sortBy = 'wins', limit = 10) {
    try {
        const snapshot = await db.collection('guilds').doc(guildId)
            .collection('game_stats')
            .get();

        const stats = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data[gameType]) {
                stats.push({
                    oderId: doc.id,
                    ...data[gameType]
                });
            }
        });

        // Trier selon le critère
        stats.sort((a, b) => {
            if (sortBy === 'winRate') {
                const rateA = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
                const rateB = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
                return rateB - rateA;
            }
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        });

        return stats.slice(0, limit);
    } catch (error) {
        console.error('[GameStats] Erreur leaderboard:', error);
        return [];
    }
}

/**
 * Récupère les stats globales d'un jeu sur le serveur
 */
async function getGlobalStats(guildId, gameType) {
    try {
        const snapshot = await db.collection('guilds').doc(guildId)
            .collection('game_stats')
            .get();

        let totalGames = 0;
        let totalPlayers = 0;
        const roleDistribution = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data[gameType]) {
                totalPlayers++;
                totalGames += data[gameType].gamesPlayed || 0;

                // Distribution des rôles
                const roleStats = data[gameType].roleStats || {};
                Object.entries(roleStats).forEach(([roleId, stats]) => {
                    if (!roleDistribution[roleId]) {
                        roleDistribution[roleId] = { played: 0, wins: 0 };
                    }
                    roleDistribution[roleId].played += stats.played || 0;
                    roleDistribution[roleId].wins += stats.wins || 0;
                });
            }
        });

        return {
            totalGames: Math.floor(totalGames / Math.max(totalPlayers, 1)), // Moyenne par joueur
            totalPlayers,
            roleDistribution
        };
    } catch (error) {
        console.error('[GameStats] Erreur stats globales:', error);
        return { totalGames: 0, totalPlayers: 0, roleDistribution: {} };
    }
}

/**
 * Réinitialise les stats d'un utilisateur pour un jeu
 */
async function resetStats(userId, guildId, gameType) {
    try {
        const statsRef = db.collection('guilds').doc(guildId)
            .collection('game_stats').doc(userId);

        await statsRef.update({
            [gameType]: { ...STATS_SCHEMA[gameType] }
        });

        return { success: true };
    } catch (error) {
        console.error('[GameStats] Erreur reset:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    GAME_TYPES,
    STATS_SCHEMA,
    getGameStats,
    updateGameStats,
    recordWerewolfGame,
    getLeaderboard,
    getGlobalStats,
    resetStats
};
