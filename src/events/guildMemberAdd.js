const { Events, EmbedBuilder } = require('discord.js');
const { db } = require('../services/firebase');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        console.log(`New member joined: ${member.user.tag}`);

        // Fetch config from Firebase
        const configRef = db.collection('config').doc('channels');
        const rolesRef = db.collection('config').doc('roles');

        const config = (await configRef.get()).data();
        const roles = (await rolesRef.get()).data();

        // Assign "Novice" role if exists
        if (roles && roles.defaultRoleId) {
            await member.roles.add(roles.defaultRoleId).catch(console.error);
        }

        // Welcome message
        if (config && config.welcomeChannelId) {
            const channel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (channel) {
                // Find rules channel (either by ID from config or by name)
                let rulesChannel = member.guild.channels.cache.get(config.rulesChannelId);
                if (!rulesChannel) {
                    rulesChannel = member.guild.channels.cache.find(c => c.name.includes('règlement') || c.name.includes('rules'));
                }

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Bienvenue sur le serveur de Mister A ${member.user.username}`)
                    .setDescription(`N'oublie pas de lire le ${rulesChannel ? `<#${rulesChannel.id}>` : '#📋┃règlement'}`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                channel.send({ embeds: [welcomeEmbed] });
            }
        }
    },
};
