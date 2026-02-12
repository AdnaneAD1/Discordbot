/**
 * Service de gestion des abonnements
 * Structure préparée pour l'intégration future des paiements (Stripe, PayPal, etc.)
 */

const { db } = require('./firebase');

// Types d'abonnements disponibles
const SUBSCRIPTION_TIERS = {
    FREE: {
        id: 'free',
        name: 'Gratuit',
        emoji: '🆓',
        color: '#95a5a6',
        price: {
            monthly: 0,
            yearly: 0
        },
        features: {
            imagesPerDay: 5,
            imageQuality: 'standard',
            imageStyles: 7,
            xpMultiplier: 1,
            customBackground: false,
            prioritySupport: false,
            earlyAccess: false,
            exclusiveBadge: null,
            maxPlaylists: 3,
            voteSkipWeight: 1,
            maxGuilds: 0
        }
    },
    SIGMA_PLAYER: {
        id: 'SIGMA_PLAYER',
        name: 'Sigma Player',
        emoji: '💎',
        color: '#f39c12',
        price: {
            monthly: 4.99,
            yearly: 39.99
        },
        features: {
            imagesPerDay: 25,
            imageQuality: 'hd',
            imageStyles: 15,
            xpMultiplier: 1.5,
            customBackground: true,
            prioritySupport: true,
            earlyAccess: true,
            exclusiveBadge: '💎',
            maxPlaylists: 10,
            voteSkipWeight: 2,
            maxGuilds: 1
        }
    },
    TITAN_SERVER: {
        id: 'TITAN_SERVER',
        name: 'Titan Server',
        emoji: '👑',
        color: '#9b59b6',
        price: {
            monthly: 9.99,
            yearly: 79.99
        },
        features: {
            imagesPerDay: 250,
            imageQuality: '4k',
            imageStyles: -1,
            xpMultiplier: 2,
            customBackground: true,
            customBackgroundUpload: true,
            prioritySupport: true,
            earlyAccess: true,
            exclusiveBadge: '👑',
            maxPlaylists: 50,
            voteSkipWeight: 3,
            noCooldowns: true,
            maxGuilds: 3
        }
    }
};

/**
 * Mappe les anciens IDs vers les nouveaux pour la transition DB
 */
function resolveTier(tierString) {
    if (!tierString) return SUBSCRIPTION_TIERS.FREE;

    const ts = tierString.toUpperCase();
    if (SUBSCRIPTION_TIERS[ts]) return SUBSCRIPTION_TIERS[ts];

    // Mappage legacy
    if (ts === 'PREMIUM') return SUBSCRIPTION_TIERS.SIGMA_PLAYER;
    if (ts === 'PREMIUM_PLUS') return SUBSCRIPTION_TIERS.TITAN_SERVER;

    return SUBSCRIPTION_TIERS.FREE;
}

// Fonctionnalités qui peuvent être débloquées par abonnement
const PREMIUM_FEATURES = {
    UNLIMITED_IMAGES: 'unlimited_images',
    HD_IMAGES: 'hd_images',
    FOUR_K_IMAGES: '4k_images',
    ALL_STYLES: 'all_styles',
    XP_BOOST: 'xp_boost',
    CUSTOM_BACKGROUND: 'custom_background',
    UPLOAD_BACKGROUND: 'upload_background',
    PRIORITY_SUPPORT: 'priority_support',
    EARLY_ACCESS: 'early_access',
    EXCLUSIVE_BADGE: 'exclusive_badge',
    UNLIMITED_PLAYLISTS: 'unlimited_playlists',
    VOTE_WEIGHT: 'vote_weight',
    NO_COOLDOWNS: 'no_cooldowns'
};

/**
 * Récupère l'abonnement d'un utilisateur
 */
async function getUserSubscription(userId, guildId = null) {
    try {
        // Vérifier d'abord l'abonnement global de l'utilisateur
        const globalSubRef = db.collection('subscriptions').doc(userId);
        const globalSubDoc = await globalSubRef.get();

        if (globalSubDoc.exists) {
            const data = globalSubDoc.data();

            // Vérifier si l'abonnement est encore valide
            if (data.expiresAt && data.expiresAt.toDate() > new Date()) {
                return {
                    tier: resolveTier(data.tier),
                    expiresAt: data.expiresAt.toDate(),
                    isActive: true,
                    billingCycle: data.billingCycle || 'monthly',
                    startedAt: data.startedAt?.toDate() || null
                };
            }
        }

        // Aucun abonnement actif
        return {
            tier: SUBSCRIPTION_TIERS.FREE,
            expiresAt: null,
            isActive: false,
            billingCycle: null,
            startedAt: null
        };
    } catch (error) {
        console.error('[Subscriptions] Erreur récupération:', error);
        return {
            tier: SUBSCRIPTION_TIERS.FREE,
            expiresAt: null,
            isActive: false,
            billingCycle: null,
            startedAt: null
        };
    }
}

/**
 * Vérifie si un utilisateur a accès à une fonctionnalité
 */
async function hasFeature(userId, featureId) {
    const subscription = await getUserSubscription(userId);
    const features = subscription.tier.features;

    switch (featureId) {
        case PREMIUM_FEATURES.UNLIMITED_IMAGES:
            return features.imagesPerDay === -1;
        case PREMIUM_FEATURES.HD_IMAGES:
            return features.imageQuality === 'hd' || features.imageQuality === '4k';
        case PREMIUM_FEATURES.FOUR_K_IMAGES:
            return features.imageQuality === '4k';
        case PREMIUM_FEATURES.ALL_STYLES:
            return features.imageStyles === -1;
        case PREMIUM_FEATURES.XP_BOOST:
            return features.xpMultiplier > 1;
        case PREMIUM_FEATURES.CUSTOM_BACKGROUND:
            return features.customBackground === true;
        case PREMIUM_FEATURES.UPLOAD_BACKGROUND:
            return features.customBackgroundUpload === true;
        case PREMIUM_FEATURES.PRIORITY_SUPPORT:
            return features.prioritySupport === true;
        case PREMIUM_FEATURES.EARLY_ACCESS:
            return features.earlyAccess === true;
        case PREMIUM_FEATURES.EXCLUSIVE_BADGE:
            return features.exclusiveBadge !== null;
        case PREMIUM_FEATURES.UNLIMITED_PLAYLISTS:
            return features.maxPlaylists === -1;
        case PREMIUM_FEATURES.VOTE_WEIGHT:
            return features.voteSkipWeight > 1;
        case PREMIUM_FEATURES.NO_COOLDOWNS:
            return features.noCooldowns === true;
        default:
            return false;
    }
}

/**
 * Récupère le multiplicateur XP d'un utilisateur
 */
async function getXpMultiplier(userId) {
    const subscription = await getUserSubscription(userId);
    return subscription.tier.features.xpMultiplier || 1;
}

/**
 * Récupère la limite d'images par jour d'un utilisateur
 */
async function getImageLimit(userId) {
    const subscription = await getUserSubscription(userId);
    return subscription.tier.features.imagesPerDay;
}

/**
 * Crée ou met à jour un abonnement (appelé après paiement réussi)
 */
async function createSubscription(userId, tierId, billingCycle = 'monthly') {
    const tier = SUBSCRIPTION_TIERS[tierId.toUpperCase()];
    if (!tier || tier.id === 'free') {
        throw new Error('Tier invalide');
    }

    const now = new Date();
    const expiresAt = new Date(now);

    if (billingCycle === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const subscriptionData = {
        tier: tier.id,
        billingCycle,
        startedAt: now,
        expiresAt,
        updatedAt: now,
        status: 'active'
    };

    await db.collection('subscriptions').doc(userId).set(subscriptionData, { merge: true });

    // Log l'événement
    await db.collection('subscription_logs').add({
        userId,
        action: 'subscription_created',
        tier: tier.id,
        billingCycle,
        timestamp: now
    });

    return {
        success: true,
        tier,
        expiresAt
    };
}

/**
 * Annule un abonnement (ne supprime pas immédiatement, attend l'expiration)
 */
async function cancelSubscription(userId) {
    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();

    if (!subDoc.exists) {
        throw new Error('Aucun abonnement trouvé');
    }

    await subRef.update({
        status: 'cancelled',
        cancelledAt: new Date()
    });

    // Log l'événement
    await db.collection('subscription_logs').add({
        userId,
        action: 'subscription_cancelled',
        timestamp: new Date()
    });

    return { success: true };
}

/**
 * Renouvelle un abonnement (appelé après paiement récurrent)
 */
async function renewSubscription(userId) {
    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();

    if (!subDoc.exists) {
        throw new Error('Aucun abonnement trouvé');
    }

    const data = subDoc.data();
    const newExpiresAt = new Date(data.expiresAt.toDate());

    if (data.billingCycle === 'yearly') {
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);
    } else {
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);
    }

    await subRef.update({
        expiresAt: newExpiresAt,
        status: 'active',
        updatedAt: new Date()
    });

    // Log l'événement
    await db.collection('subscription_logs').add({
        userId,
        action: 'subscription_renewed',
        timestamp: new Date()
    });

    return { success: true, newExpiresAt };
}

/**
 * Récupère tous les abonnements actifs (pour analytics)
 */
async function getActiveSubscriptions() {
    const now = new Date();
    const snapshot = await db.collection('subscriptions')
        .where('status', '==', 'active')
        .where('expiresAt', '>', now)
        .get();

    return snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
    }));
}

/**
 * Vérifie et expire les abonnements périmés
 */
async function checkExpiredSubscriptions() {
    const now = new Date();
    const snapshot = await db.collection('subscriptions')
        .where('status', '==', 'active')
        .where('expiresAt', '<=', now)
        .get();

    const batch = db.batch();
    const expiredUsers = [];

    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
            status: 'expired',
            expiredAt: now
        });
        expiredUsers.push(doc.id);
    });

    if (expiredUsers.length > 0) {
        await batch.commit();
        console.log(`[Subscriptions] ${expiredUsers.length} abonnement(s) expiré(s)`);
    }

    return expiredUsers;
}

/**
 * Récupère tous les tiers disponibles
 */
function getAvailableTiers() {
    return Object.values(SUBSCRIPTION_TIERS);
}

/**
 * Récupère un tier par son ID
 */
function getTierById(tierId) {
    return SUBSCRIPTION_TIERS[tierId.toUpperCase()] || null;
}

/**
 * Formate le prix pour l'affichage
 */
function formatPrice(amount, currency = 'EUR') {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency
    }).format(amount);
}

/**
 * Calcule les économies pour un abonnement annuel
 */
function calculateYearlySavings(tierId) {
    const tier = SUBSCRIPTION_TIERS[tierId.toUpperCase()];
    if (!tier) return 0;

    const monthlyTotal = tier.price.monthly * 12;
    const yearlyPrice = tier.price.yearly;

    return monthlyTotal - yearlyPrice;
}

// ===== GESTION DES SERVEURS PREMIUM =====

/**
 * Vérifie si un serveur a le premium activé (par n'importe quel utilisateur)
 */
async function isGuildPremium(guildId) {
    try {
        const snapshot = await db.collection('subscriptions')
            .where('status', '==', 'active')
            .where('activeGuildIds', 'array-contains', guildId)
            .limit(1)
            .get();

        if (snapshot.empty) return { isPremium: false, sponsor: null, tier: null };

        const doc = snapshot.docs[0];
        const data = doc.data();

        // Vérifier expiration
        if (data.expiresAt && data.expiresAt.toDate() <= new Date()) {
            return { isPremium: false, sponsor: null, tier: null };
        }

        return {
            isPremium: true,
            sponsor: doc.id, // userId du sponsor
            tier: resolveTier(data.tier)
        };
    } catch (error) {
        console.error('[Subscriptions] Erreur isGuildPremium:', error);
        return { isPremium: false, sponsor: null, tier: null };
    }
}

/**
 * Active le premium sur un serveur pour un utilisateur
 */
async function activateGuild(userId, guildId) {
    const subscription = await getUserSubscription(userId);

    if (!subscription.isActive || subscription.tier.id === 'free') {
        return { success: false, error: 'Aucun abonnement premium actif.' };
    }

    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();
    const data = subDoc.data();

    const activeGuilds = data.activeGuildIds || [];
    const maxGuilds = subscription.tier.features.maxGuilds || 1;

    // Vérifier si déjà activé
    if (activeGuilds.includes(guildId)) {
        return { success: false, error: 'Ce serveur est déjà activé.' };
    }

    // Vérifier la limite
    if (activeGuilds.length >= maxGuilds) {
        return {
            success: false,
            error: `Tu as atteint la limite de ${maxGuilds} serveur(s). Utilise \`/premium transfer\` pour changer.`
        };
    }

    // Ajouter le serveur
    activeGuilds.push(guildId);
    await subRef.update({ activeGuildIds: activeGuilds });

    return { success: true, activeGuilds };
}

/**
 * Désactive le premium sur un serveur
 */
async function deactivateGuild(userId, guildId) {
    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();

    if (!subDoc.exists) {
        return { success: false, error: 'Aucun abonnement trouvé.' };
    }

    const data = subDoc.data();
    const activeGuilds = data.activeGuildIds || [];

    if (!activeGuilds.includes(guildId)) {
        return { success: false, error: 'Ce serveur n\'est pas activé.' };
    }

    const newGuilds = activeGuilds.filter(id => id !== guildId);
    await subRef.update({ activeGuildIds: newGuilds });

    return { success: true, activeGuilds: newGuilds };
}

/**
 * Transfère le premium d'un serveur à un autre
 */
async function transferGuild(userId, fromGuildId, toGuildId) {
    const deactivateResult = await deactivateGuild(userId, fromGuildId);
    if (!deactivateResult.success) {
        return deactivateResult;
    }

    const activateResult = await activateGuild(userId, toGuildId);
    if (!activateResult.success) {
        // Rollback
        await activateGuild(userId, fromGuildId);
        return activateResult;
    }

    return { success: true, from: fromGuildId, to: toGuildId };
}

/**
 * Récupère les serveurs actifs d'un utilisateur
 */
async function getActiveGuilds(userId) {
    const subRef = db.collection('subscriptions').doc(userId);
    const subDoc = await subRef.get();

    if (!subDoc.exists) return [];

    return subDoc.data().activeGuildIds || [];
}

module.exports = {
    SUBSCRIPTION_TIERS,
    PREMIUM_FEATURES,
    getUserSubscription,
    hasFeature,
    getXpMultiplier,
    getImageLimit,
    createSubscription,
    cancelSubscription,
    renewSubscription,
    getActiveSubscriptions,
    checkExpiredSubscriptions,
    getAvailableTiers,
    getTierById,
    formatPrice,
    calculateYearlySavings,
    // Guild management
    isGuildPremium,
    activateGuild,
    deactivateGuild,
    transferGuild,
    getActiveGuilds
};
