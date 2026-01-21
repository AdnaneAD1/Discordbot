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
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Bienvenue sur le serveur de mister A`)
                    .setDescription(`Yoooo ${member}, bienvenue dans la team.\n\nN'oublie pas de lire le règlement dans le salon <#${config.rulesChannelId || '📋┃règlement'}>`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                channel.send({ embeds: [welcomeEmbed] });
            }
        }
    },
};
