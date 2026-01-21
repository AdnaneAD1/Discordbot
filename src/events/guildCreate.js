const { Events } = require('discord.js');
const { db } = require('../services/firebase');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        console.log(`Bot joined a new guild: ${guild.name} (${guild.id})`);

        const guildConfigRef = db.collection('guilds').doc(guild.id).collection('config');

        // Check if config already exists to avoid overwriting
        const generalDoc = await guildConfigRef.doc('general').get();
        if (generalDoc.exists) return;

        // Initialize default configuration
        await guildConfigRef.doc('general').set({
            serverName: guild.name,
            embedColor: '#0099ff',
            logoUrl: guild.iconURL({ dynamic: true }) || null,
            createdAt: new Date()
        });

        // Initialize default XP grades
        await guildConfigRef.doc('grades').set({
            paliers: [
                { name: "Recrue", xp: 0 },
                { name: "Vétéran", xp: 200 },
                { name: "Élite", xp: 600 },
                { name: "Pro", xp: 1200 },
                { name: "Maître", xp: 2500 },
                { name: "Grand Maître", xp: 5000 },
                { name: "Légendaire", xp: 10000 }
            ]
        });

        console.log(`Successfully initialized default data for guild: ${guild.name}`);
    },
};
