const { Events } = require('discord.js');
const { addXP } = require('../systems/xp');
const { checkMessage } = require('../systems/moderation');
const { checkToxicity } = require('../systems/sentinel');

// Cooldown to prevent spam XP (1 minute)
const xpCooldowns = new Set();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // 1. Moderation System (Priority)
        const moderated = await checkMessage(message);
        if (moderated) return;

        // 2. IA Sentinel (Silence analysis)
        checkToxicity(message).catch(err => console.error('[Sentinel] Error:', err));

        // 3. XP System logic
        if (!xpCooldowns.has(message.author.id)) {
            const { getXpMultiplier } = require('../services/subscriptions');
            const multiplier = await getXpMultiplier(message.author.id);

            const baseAmount = Math.floor(Math.random() * 11) + 15; // 15-25 XP
            const xpAmount = Math.round(baseAmount * multiplier);

            await addXP(message.member, xpAmount, 'message');

            xpCooldowns.add(message.author.id);
            setTimeout(() => xpCooldowns.delete(message.author.id), 60000);
        }
    },
};
