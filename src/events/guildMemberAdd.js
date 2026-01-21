const { Events, EmbedBuilder } = require('discord.js');
const { db } = require('../services/firebase');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        console.log(`New member joined: ${member.user.tag}`);

        // Fetch config from Firebase
        const guildId = member.guild.id;
        const guildConfigRef = db.collection('guilds').doc(guildId).collection('config');

        const config = (await guildConfigRef.doc('channels').get()).data();
        const roles = (await guildConfigRef.doc('roles').get()).data();
        const general = (await guildConfigRef.doc('general').get()).data() || {};

        const embedColor = general.embedColor || '#0099ff';
        const serverName = general.serverName || 'Mister A';
        const logoUrl = general.logoUrl || null;

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
                    .setColor(embedColor)
                    .setAuthor({ name: serverName, iconURL: logoUrl || interaction.guild.iconURL() })
                    .setDescription(`Bienvenue sur le serveur de **${serverName}**, ${member} !\n\nN'oublie pas de lire le ${rulesChannel ? `<#${rulesChannel.id}>` : '#📋┃règlement'} pour bien commencer l'aventure.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setTimestamp();

                channel.send({ embeds: [welcomeEmbed] });
            }
        }
    },
};
