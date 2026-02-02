/**
 * Utilitaires pour la gestion des mentions Discord
 *
 * Les mentions Discord (<@ID>) se résolvent correctement quand :
 * 1. Le membre est dans le cache du bot (grâce aux Partials et GuildMembers intent)
 * 2. Le message est envoyé dans un contexte où Discord peut résoudre la mention
 *
 * Ce module fournit des fonctions pour s'assurer que les mentions fonctionnent correctement.
 */

/**
 * S'assure qu'un membre est en cache et retourne sa mention
 * Cette fonction fetch le membre s'il n'est pas en cache pour garantir
 * que la mention <@ID> se résoudra correctement côté Discord
 *
 * @param {Guild} guild - Le serveur Discord
 * @param {string} userId - L'ID de l'utilisateur
 * @returns {Promise<string>} - La mention formatée <@ID>
 */
async function ensureMention(guild, userId) {
    try {
        // Tenter de récupérer le membre pour le mettre en cache
        let member = guild.members.cache.get(userId);
        if (!member) {
            member = await guild.members.fetch(userId).catch(() => null);
        }
        // Retourner la mention standard - elle sera résolue car le membre est maintenant en cache
        return `<@${userId}>`;
    } catch (error) {
        // En cas d'erreur, retourner quand même la mention
        return `<@${userId}>`;
    }
}

/**
 * S'assure que plusieurs membres sont en cache et retourne leurs mentions
 * Optimisé pour les cas où on doit mentionner plusieurs personnes
 *
 * @param {Guild} guild - Le serveur Discord
 * @param {string[]} userIds - Liste des IDs d'utilisateurs
 * @returns {Promise<Map<string, string>>} - Map ID -> mention
 */
async function ensureMentions(guild, userIds) {
    const mentions = new Map();

    try {
        // Fetch tous les membres en une seule requête si possible
        const missingIds = userIds.filter(id => !guild.members.cache.has(id));
        if (missingIds.length > 0) {
            await guild.members.fetch({ user: missingIds }).catch(() => { });
        }
    } catch (error) {
        // Continuer même en cas d'erreur
    }

    for (const userId of userIds) {
        mentions.set(userId, `<@${userId}>`);
    }

    return mentions;
}

/**
 * Prépare une liste de joueurs avec leurs mentions résolues
 * Utile pour le Loup-Garou et autres jeux
 *
 * @param {Guild} guild - Le serveur Discord
 * @param {Array<{id: string, username: string}>} players - Liste des joueurs
 * @returns {Promise<void>} - Les joueurs sont mis en cache
 */
async function cachePlayersForMentions(guild, players) {
    const userIds = players.map(p => p.id);
    // On fetch même s'ils sont déjà là, pour être sûr d'avoir les données les plus fraîches 
    // et forcer Discord à "réveiller" l'ID pour ce bot.
    try {
        await guild.members.fetch({ user: userIds });
    } catch (error) {
        console.warn('[Mentions] Impossible de fetch certains membres:', error.message);
    }
}

/**
 * Crée une mention cliquable pour un utilisateur
 * Format standard Discord: <@USER_ID>
 *
 * @param {string} userId - L'ID de l'utilisateur
 * @returns {string} - La mention formatée
 */
function mention(userId) {
    return `<@${userId}>`;
}

/**
 * Crée une mention de rôle
 * @param {string} roleId - L'ID du rôle
 * @returns {string} - La mention formatée
 */
function roleMention(roleId) {
    return `<@&${roleId}>`;
}

/**
 * Crée une mention de channel
 * @param {string} channelId - L'ID du channel
 * @returns {string} - La mention formatée
 */
function channelMention(channelId) {
    return `<#${channelId}>`;
}

/**
 * Formate une liste de joueurs en mentions séparées par des virgules
 *
 * @param {Array<{id: string}>} players - Liste des joueurs
 * @returns {string} - Liste formatée
 */
function formatPlayerMentions(players) {
    return players.map(p => `<@${p.id}>`).join(', ');
}

/**
 * Formate une liste de joueurs en mentions avec retour à la ligne
 *
 * @param {Array<{id: string}>} players - Liste des joueurs
 * @returns {string} - Liste formatée
 */
function formatPlayerMentionsList(players) {
    return players.map(p => `<@${p.id}>`).join('\n');
}

module.exports = {
    ensureMention,
    ensureMentions,
    cachePlayersForMentions,
    mention,
    roleMention,
    channelMention,
    formatPlayerMentions,
    formatPlayerMentionsList
};
