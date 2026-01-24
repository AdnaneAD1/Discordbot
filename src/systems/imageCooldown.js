const { db } = require('../services/firebase');

const COOLDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
const MAX_IMAGES_PER_DAY = 5;

class ImageCooldown {
    async checkCooldown(guildId, userId) {
        const now = Date.now();
        const cooldownRef = db.collection('guilds').doc(guildId).collection('imageCooldowns').doc(userId);
        const doc = await cooldownRef.get();

        if (!doc.exists) {
            return { allowed: true, remaining: MAX_IMAGES_PER_DAY };
        }

        const data = doc.data();
        const timestamps = data.timestamps || [];

        // Filtrer les timestamps qui sont encore dans la fenêtre de 24h
        const recentTimestamps = timestamps.filter(ts => now - ts < COOLDOWN_DURATION);

        if (recentTimestamps.length >= MAX_IMAGES_PER_DAY) {
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
            remaining: MAX_IMAGES_PER_DAY - recentTimestamps.length
        };
    }

    async recordGeneration(guildId, userId) {
        const now = Date.now();
        const cooldownRef = db.collection('guilds').doc(guildId).collection('imageCooldowns').doc(userId);
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
