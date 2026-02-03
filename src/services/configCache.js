const { db } = require('./firebase');

class ConfigCache {
    constructor() {
        this.cache = new Map(); // guildId -> { configType -> { data, timestamp } }
        this.TTL = 5 * 60 * 1000; // 5 minutes
    }

    async getConfig(guildId, type) {
        const guildCache = this.cache.get(guildId) || {};
        const entry = guildCache[type];

        if (entry && (Date.now() - entry.timestamp < this.TTL)) {
            return entry.data;
        }

        // Fetch from DB
        try {
            const doc = await db.collection('guilds').doc(guildId).collection('config').doc(type).get();
            const data = doc.exists ? doc.data() : null;

            this.setCache(guildId, type, data);
            return data;
        } catch (error) {
            console.error(`[ConfigCache] Error fetching ${type} for ${guildId}:`, error);
            return entry ? entry.data : null; // Fallback to stale data if exists
        }
    }

    setCache(guildId, type, data) {
        const guildCache = this.cache.get(guildId) || {};
        guildCache[type] = {
            data: data,
            timestamp: Date.now()
        };
        this.cache.set(guildId, guildCache);
    }

    invalidate(guildId, type) {
        const guildCache = this.cache.get(guildId);
        if (guildCache && guildCache[type]) {
            delete guildCache[type];
        }
    }
}

module.exports = new ConfigCache();
