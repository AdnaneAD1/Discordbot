/**
 * Système de profils personnalisés
 * Gère les profils utilisateurs avec bio, badges, backgrounds, etc.
 */

const { db } = require('../services/firebase');

// Backgrounds disponibles par défaut
const DEFAULT_BACKGROUNDS = {
    default: {
        id: 'default',
        name: 'Classique',
        color: '#2b2d31',
        premium: false
    },
    gradient_blue: {
        id: 'gradient_blue',
        name: 'Dégradé Bleu',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        premium: false
    },
    gradient_sunset: {
        id: 'gradient_sunset',
        name: 'Coucher de Soleil',
        color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        premium: false
    },
    gradient_ocean: {
        id: 'gradient_ocean',
        name: 'Océan',
        color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        premium: true
    },
    gradient_fire: {
        id: 'gradient_fire',
        name: 'Feu',
        color: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
        premium: true
    },
    gradient_forest: {
        id: 'gradient_forest',
        name: 'Forêt',
        color: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
        premium: true
    },
    gradient_night: {
        id: 'gradient_night',
        name: 'Nuit Étoilée',
        color: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        premium: true
    },
    gradient_aurora: {
        id: 'gradient_aurora',
        name: 'Aurore Boréale',
        color: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)',
        premium: true
    },
    gradient_codm: {
        id: 'gradient_codm',
        name: 'CODM',
        color: 'linear-gradient(135deg, #febc11 0%, #c99800 100%)',
        premium: false
    }
};

// Badges disponibles
const BADGES = {
    // Badges de participation
    early_supporter: {
        id: 'early_supporter',
        name: 'Early Supporter',
        emoji: '🌟',
        description: 'A rejoint le serveur avant la v2.0',
        rarity: 'rare'
    },
    active_member: {
        id: 'active_member',
        name: 'Membre Actif',
        emoji: '💬',
        description: '1000+ messages envoyés',
        rarity: 'common'
    },
    veteran: {
        id: 'veteran',
        name: 'Vétéran',
        emoji: '🎖️',
        description: 'Membre depuis plus de 6 mois',
        rarity: 'uncommon'
    },

    // Badges de jeu
    werewolf_master: {
        id: 'werewolf_master',
        name: 'Maître Loup-Garou',
        emoji: '🐺',
        description: '50+ victoires au Loup-Garou',
        rarity: 'rare'
    },
    werewolf_survivor: {
        id: 'werewolf_survivor',
        name: 'Survivant',
        emoji: '🏃',
        description: 'Survécu à 10 parties consécutives',
        rarity: 'epic'
    },
    lucky_winner: {
        id: 'lucky_winner',
        name: 'Chanceux',
        emoji: '🍀',
        description: 'Gagné 5+ giveaways',
        rarity: 'uncommon'
    },

    // Badges de progression
    legendary_rank: {
        id: 'legendary_rank',
        name: 'Légendaire',
        emoji: '👑',
        description: 'Atteint le grade Légendaire',
        rarity: 'legendary'
    },
    challenge_champion: {
        id: 'challenge_champion',
        name: 'Champion des Défis',
        emoji: '🏆',
        description: 'Complété 50+ défis',
        rarity: 'rare'
    },

    // Badges spéciaux
    bug_hunter: {
        id: 'bug_hunter',
        name: 'Chasseur de Bugs',
        emoji: '🐛',
        description: 'A signalé un bug important',
        rarity: 'rare'
    },
    contributor: {
        id: 'contributor',
        name: 'Contributeur',
        emoji: '💎',
        description: 'A contribué au développement',
        rarity: 'legendary'
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        emoji: '⭐',
        description: 'Abonné Premium',
        rarity: 'special'
    },
    premium_plus: {
        id: 'premium_plus',
        name: 'Premium+',
        emoji: '👑',
        description: 'Abonné Premium+',
        rarity: 'special'
    }
};

// Couleurs de rareté
const RARITY_COLORS = {
    common: '#95a5a6',
    uncommon: '#2ecc71',
    rare: '#3498db',
    epic: '#9b59b6',
    legendary: '#f39c12',
    special: '#e91e63'
};

/**
 * Récupère le profil d'un utilisateur
 */
async function getProfile(userId, guildId) {
    try {
        const profileRef = db.collection('guilds').doc(guildId).collection('profiles').doc(userId);
        const profileDoc = await profileRef.get();

        if (profileDoc.exists) {
            return profileDoc.data();
        }

        // Profil par défaut
        return {
            bio: '',
            background: 'default',
            accentColor: '#febc11',
            badges: [],
            showXp: true,
            showRank: true,
            showStats: true,
            customTitle: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date()
        };
    } catch (error) {
        console.error('[Profiles] Erreur récupération:', error);
        return null;
    }
}

/**
 * Met à jour le profil d'un utilisateur
 */
async function updateProfile(userId, guildId, updates) {
    try {
        const profileRef = db.collection('guilds').doc(guildId).collection('profiles').doc(userId);

        await profileRef.set({
            ...updates,
            updatedAt: new Date()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('[Profiles] Erreur mise à jour:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Ajoute un badge à un utilisateur
 */
async function addBadge(userId, guildId, badgeId) {
    const badge = BADGES[badgeId];
    if (!badge) {
        throw new Error('Badge invalide');
    }

    const profile = await getProfile(userId, guildId);
    const badges = profile.badges || [];

    if (badges.includes(badgeId)) {
        return { success: false, error: 'Badge déjà possédé' };
    }

    badges.push(badgeId);

    await updateProfile(userId, guildId, { badges });

    return { success: true, badge };
}

/**
 * Retire un badge à un utilisateur
 */
async function removeBadge(userId, guildId, badgeId) {
    const profile = await getProfile(userId, guildId);
    const badges = (profile.badges || []).filter(b => b !== badgeId);

    await updateProfile(userId, guildId, { badges });

    return { success: true };
}

/**
 * Vérifie et attribue automatiquement les badges
 */
async function checkAndAwardBadges(userId, guildId, member) {
    const awardedBadges = [];
    const profile = await getProfile(userId, guildId);
    const currentBadges = profile.badges || [];

    // Récupérer les données utilisateur
    const userDoc = await db.collection('guilds').doc(guildId).collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Badge Légendaire
    if (userData.level === 'Légendaire' && !currentBadges.includes('legendary_rank')) {
        await addBadge(userId, guildId, 'legendary_rank');
        awardedBadges.push(BADGES.legendary_rank);
    }

    // Badge Vétéran (6 mois sur le serveur)
    if (member && member.joinedAt) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        if (member.joinedAt < sixMonthsAgo && !currentBadges.includes('veteran')) {
            await addBadge(userId, guildId, 'veteran');
            awardedBadges.push(BADGES.veteran);
        }
    }

    // Récupérer les stats de jeu pour d'autres badges
    const gameStatsDoc = await db.collection('guilds').doc(guildId).collection('game_stats').doc(userId).get();
    const gameStats = gameStatsDoc.exists ? gameStatsDoc.data() : {};

    // Badge Maître Loup-Garou
    const werewolfWins = gameStats.werewolf?.wins || 0;
    if (werewolfWins >= 50 && !currentBadges.includes('werewolf_master')) {
        await addBadge(userId, guildId, 'werewolf_master');
        awardedBadges.push(BADGES.werewolf_master);
    }

    // Badge Champion des Défis
    const completedChallenges = userData.completedChallenges || 0;
    if (completedChallenges >= 50 && !currentBadges.includes('challenge_champion')) {
        await addBadge(userId, guildId, 'challenge_champion');
        awardedBadges.push(BADGES.challenge_champion);
    }

    return awardedBadges;
}

/**
 * Récupère tous les backgrounds disponibles pour un utilisateur
 */
async function getAvailableBackgrounds(userId, isPremium = false) {
    return Object.values(DEFAULT_BACKGROUNDS).filter(bg => {
        if (bg.premium && !isPremium) return false;
        return true;
    });
}

/**
 * Récupère les informations d'un badge
 */
function getBadgeInfo(badgeId) {
    return BADGES[badgeId] || null;
}

/**
 * Récupère tous les badges disponibles
 */
function getAllBadges() {
    return Object.values(BADGES);
}

/**
 * Récupère tous les backgrounds
 */
function getAllBackgrounds() {
    return Object.values(DEFAULT_BACKGROUNDS);
}

/**
 * Formate les badges pour l'affichage
 */
function formatBadges(badgeIds) {
    return badgeIds
        .map(id => BADGES[id])
        .filter(badge => badge)
        .map(badge => badge.emoji)
        .join(' ');
}

module.exports = {
    DEFAULT_BACKGROUNDS,
    BADGES,
    RARITY_COLORS,
    getProfile,
    updateProfile,
    addBadge,
    removeBadge,
    checkAndAwardBadges,
    getAvailableBackgrounds,
    getBadgeInfo,
    getAllBadges,
    getAllBackgrounds,
    formatBadges
};
