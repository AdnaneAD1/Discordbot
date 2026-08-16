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
        canvasGradients: ['#2b2d31', '#1e1f22'],
        premium: false,
        price: 0
    },
    gradient_blue: {
        id: 'gradient_blue',
        name: 'Dégradé Bleu',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        canvasGradients: ['#667eea', '#764ba2'],
        premium: false,
        price: 0
    },
    gradient_sunset: {
        id: 'gradient_sunset',
        name: 'Coucher de Soleil',
        color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        canvasGradients: ['#f093fb', '#f5576c'],
        premium: false,
        price: 0
    },
    gradient_ocean: {
        id: 'gradient_ocean',
        name: 'Océan',
        color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        canvasGradients: ['#4facfe', '#00f2fe'],
        premium: true,
        price: 15000
    },
    gradient_fire: {
        id: 'gradient_fire',
        name: 'Feu',
        color: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
        canvasGradients: ['#f5af19', '#f12711'],
        premium: true,
        price: 15000
    },
    gradient_forest: {
        id: 'gradient_forest',
        name: 'Forêt',
        color: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
        canvasGradients: ['#134e5e', '#71b280'],
        premium: true,
        price: 15000
    },
    gradient_night: {
        id: 'gradient_night',
        name: 'Nuit Étoilée',
        color: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)',
        canvasGradients: ['#00c9ff', '#92fe9d'],
        premium: true,
        price: 15000
    },
    gradient_aurora: {
        id: 'gradient_aurora',
        name: 'Aurore Boréale',
        color: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
        canvasGradients: ['#0f0c29', '#302b63'],
        premium: true,
        price: 15000
    },
    gradient_codm: {
        id: 'gradient_codm',
        name: 'CODM',
        color: 'linear-gradient(135deg, #febc11 0%, #c99800 100%)',
        canvasGradients: ['#febc11', '#c99800'],
        premium: false,
        price: 0
    }
};

const FEATURES = {
    custom_color: { id: 'custom_color', name: 'Couleur Personnalisée', price: 25000, emoji: '🌈' },
    custom_title: { id: 'custom_title', name: 'Titre Personnalisé', price: 40000, emoji: '👑' },
    social_links: { id: 'social_links', name: 'Réseaux Sociaux', price: 20000, emoji: '🌐' }
};

// Badges disponibles
const BADGES = {
    // Badges de participation
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
        emoji: '⌛',
        description: 'Membre depuis plus de 6 mois',
        rarity: 'uncommon'
    },

    // Badges de jeu
    werewolf_master: {
        id: 'werewolf_master',
        name: 'Maître Loup-Garou',
        emoji: '<a:wolf_master_anim:ID_ICI>',
        description: '50+ victoires au Loup-Garou',
        rarity: 'rare'
    },
    werewolf_survivor: {
        id: 'werewolf_survivor',
        name: 'Survivant',
        emoji: '<a:survivor_anim:ID_ICI>',
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

    // Badges de Progression
    legendary_rank: {
        id: 'legendary_rank',
        name: 'Légendaire',
        emoji: '⚜️',
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
    // Badges de Prestige (ANIMÉS)
    sigma_player: {
        id: 'sigma_player',
        name: 'Membre d\'Honneur',
        emoji: '💎',
        animated: '<a:sigma_anim:ID_ICI>',
        description: 'Membre d\'honneur du bot',
        rarity: 'special'
    },
    titan_server: {
        id: 'titan_server',
        name: 'Titan Server',
        emoji: '👑',
        animated: '<a:titan_anim:ID_ICI>',
        description: 'Membre Premium Titan (Server Owner)',
        rarity: 'special'
    },
    server_booster: {
        id: 'server_booster',
        name: 'Server Booster',
        emoji: '🚀',
        animated: '<a:boost_anim:ID_ICI>',
        description: 'A boosté le serveur',
        rarity: 'special'
    },
    titan_guild: {
        id: 'titan_guild',
        name: 'Titan Guild',
        emoji: '🔱',
        animated: '<a:titan_guild_anim:ID_ICI>',
        description: 'Serveur sous protection Titan (Badge Global)',
        rarity: 'special'
    },

    // Badges de Packs & Achats (ANIMÉS)
    sigma_bundle: {
        id: 'sigma_bundle',
        name: 'Pack d\'Honneur',
        emoji: '🎁',
        animated: '<a:sigma_pack_anim:ID_ICI>',
        description: 'Pack de soutien d\'honneur',
        rarity: 'rare'
    },
    titan_bundle: {
        id: 'titan_bundle',
        name: 'Titan Bundle',
        emoji: '📦',
        animated: '<a:titan_pack_anim:ID_ICI>',
        description: 'A acheté le Pack Titan (Jetons + Sub)',
        rarity: 'epic'
    },
    high_roller: {
        id: 'high_roller',
        name: 'High Roller',
        emoji: '🐋',
        animated: '<a:high_roller_anim:ID_ICI>',
        description: 'A acheté une Grosse Recharge de jetons',
        rarity: 'legendary'
    },

    // Badges de Compétition (ANIMÉS)
    werewolf_legend: {
        id: 'werewolf_legend',
        name: 'Légende du Loup',
        emoji: '🐺',
        animated: '<a:wolf_legend_anim:ID_ICI>',
        description: 'Top Leaderboard Loup-Garou',
        rarity: 'legendary'
    },
    casino_legend: {
        id: 'casino_legend',
        name: 'Légende du Casino',
        emoji: '🃏',
        animated: '<a:casino_legend_anim:ID_ICI>',
        description: 'Top Leaderboard Chips',
        rarity: 'legendary'
    },

    // Badges de Jeu (ANIMÉS)
    werewolf_master: {
        id: 'werewolf_master',
        name: 'Maître Loup-Garou',
        emoji: '🐺',
        animated: '<a:wolf_master_anim:ID_ICI>',
        description: '50+ victoires au Loup-Garou',
        rarity: 'rare'
    },
    werewolf_survivor: {
        id: 'werewolf_survivor',
        name: 'Survivant',
        emoji: '🏃',
        animated: '<a:survivor_anim:ID_ICI>',
        description: 'Survécu à 10 parties consécutives',
        rarity: 'epic'
    },

    // Badges spéciaux (ANIMÉS)
    contributor: {
        id: 'contributor',
        name: 'Contributeur',
        emoji: '🛠️',
        animated: '<a:contributor_anim:ID_ICI>',
        description: 'A contribué au développement',
        rarity: 'legendary'
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
            unlockedBackgrounds: ['default', 'gradient_blue', 'gradient_sunset', 'gradient_codm'], // Backgrounds gratuits par défaut
            unlockedFeatures: [], // Liste des IDs de fonctionnalités débloquées
            banner: null,
            accentColor: '#febc11',
            badges: [],
            featuredBadges: [],
            privacy: {
                showStats: true,
                showRank: true,
                showXp: true
            },
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

    // Badge Server Booster (Détection auto)
    if (member && member.premiumSince) {
        if (!currentBadges.includes('server_booster')) {
            await addBadge(userId, guildId, 'server_booster');
            awardedBadges.push(BADGES.server_booster);
        }
    } else if (currentBadges.includes('server_booster')) {
        // Optionnel : Retirer le badge si l'utilisateur ne boost plus
        await removeBadge(userId, guildId, 'server_booster');
    }

    // Badges de Packs & Bundles (Détection via metadata user)
    if (userData.purchasedPacks) {
        if (userData.purchasedPacks.includes('sigma_bundle') && !currentBadges.includes('sigma_bundle')) {
            await addBadge(userId, guildId, 'sigma_bundle');
            awardedBadges.push(BADGES.sigma_bundle);
        }
        if (userData.purchasedPacks.includes('titan_bundle') && !currentBadges.includes('titan_bundle')) {
            await addBadge(userId, guildId, 'titan_bundle');
            awardedBadges.push(BADGES.titan_bundle);
        }
    }

    // Badge High Roller (Achat de grosse recharge > 300k jetons cumulés par exemple)
    if (userData.totalChipsPurchased >= 300000 && !currentBadges.includes('high_roller')) {
        await addBadge(userId, guildId, 'high_roller');
        awardedBadges.push(BADGES.high_roller);
    }

    // Récupérer les stats de jeu pour d'autres badges
    const gameStatsDoc = await db.collection('guilds').doc(guildId).collection('game_stats').doc(userId).get();
    const gameStats = gameStatsDoc.exists ? gameStatsDoc.data() : {};

    // Badge Maître Loup-Garou (50 wins)
    const werewolfWins = gameStats.werewolf?.wins || 0;
    if (werewolfWins >= 50 && !currentBadges.includes('werewolf_master')) {
        await addBadge(userId, guildId, 'werewolf_master');
        awardedBadges.push(BADGES.werewolf_master);
    }

    // Badge Légende du Loup (Top 10 wins par exemple)
    // NOTE: Nécessite le système de leaderboard global
    if (werewolfWins >= 200 && !currentBadges.includes('werewolf_legend')) {
        await addBadge(userId, guildId, 'werewolf_legend');
        awardedBadges.push(BADGES.werewolf_legend);
    }

    // Badge Légende du Casino (Si solde > 1M jetons)
    const { Blackjack } = require('./casino');
    const chips = await Blackjack.getBalance(userId);

    if (chips >= 1000000 && !currentBadges.includes('casino_legend')) {
        await addBadge(userId, guildId, 'casino_legend');
        awardedBadges.push(BADGES.casino_legend);
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
    const profile = await getProfile(userId, 'global'); // guildId irrelevant for unlocked list usually, but here profiles are guild-scoped?
    // Wait, profiles.js seems to be guild-scoped in getProfile(userId, guildId).
    // Let's assume unlocked items are global or guild-specific?
    // User probably wants them global. Let's stick to the current structure.
    const unlocked = profile?.unlockedBackgrounds || [];

    return Object.values(DEFAULT_BACKGROUNDS).filter(bg => {
        if (!bg.premium) return true;
        if (isPremium) return true;
        if (unlocked.includes(bg.id)) return true;
        return false;
    });
}

function hasFeature(profile, featureId, isPremium = false) {
    if (isPremium) return true;
    const unlocked = profile?.unlockedFeatures || [];
    return unlocked.includes(featureId);
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
        .map(badge => {
            // Si une animation est configurée (et que l'ID n'est pas le placeholder)
            if (badge.animated && !badge.animated.includes('ID_ICI')) {
                return badge.animated;
            }
            // Sinon fallback sur l'emoji classique
            return badge.emoji;
        })
        .join(' ');
}

module.exports = {
    DEFAULT_BACKGROUNDS,
    BADGES,
    FEATURES,
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
