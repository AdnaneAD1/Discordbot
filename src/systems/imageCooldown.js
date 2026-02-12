const { db } = require('../services/firebase');
const { getUserSubscription } = require('../services/subscriptions');

const COOLDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
const MAX_IMAGES_PER_DAY = 5;

class ImageCooldown {
    async checkCooldown(guildId, userId) {
        const subscription = await getUserSubscription(userId);
        if (subscription.tier.features.noCooldowns) {
            return { allowed: true, remaining: 999, isPremium: true, maxImages: 999 };
        }

        const maxImages = subscription.tier.features.imagesPerDay || MAX_IMAGES_PER_DAY;
        const now = Date.now();
        const cooldownRef = db.collection('users').doc(userId).collection('cooldowns').doc('image');
        const doc = await cooldownRef.get();

        if (!doc.exists) {
            return { allowed: true, remaining: maxImages };
        }

        const data = doc.data();
        const timestamps = data.timestamps || [];

        // Filtrer les timestamps qui sont encore dans la fenêtre de 24h
        const recentTimestamps = timestamps.filter(ts => now - ts < COOLDOWN_DURATION);

        if (recentTimestamps.length >= maxImages) {
            const oldestTimestamp = Math.min(...recentTimestamps);
            const resetTime = oldestTimestamp + COOLDOWN_DURATION;
            const hoursLeft = Math.ceil((resetTime - now) / 3600000);

            return {
                allowed: false,
                remaining: 0,
                resetIn: hoursLeft
            };
        }

        return {
            allowed: true,
            remaining: maxImages - recentTimestamps.length,
            maxImages: maxImages
        };
    }

    async recordGeneration(guildId, userId) {
        const subscription = await getUserSubscription(userId);
        if (subscription.tier.features.noCooldowns) return;

        const now = Date.now();
        const cooldownRef = db.collection('users').doc(userId).collection('cooldowns').doc('image');
        const doc = await cooldownRef.get();

        let timestamps = [];
        if (doc.exists) {
            timestamps = doc.data().timestamps || [];
        }

        // Ajouter le nouveau timestamp et filtrer les anciens
        timestamps.push(now);
        timestamps = timestamps.filter(ts => now - ts < COOLDOWN_DURATION);

        await cooldownRef.set({ timestamps, lastUpdated: now }, { merge: true });
    }

    async getRemainingCount(guildId, userId) {
        const check = await this.checkCooldown(guildId, userId);
        return check.remaining;
    }
}

module.exports = new ImageCooldown();
