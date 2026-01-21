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

        // Assign "Non-verified" role if exists
        if (roles && roles.unverifiedRoleId) {
            await member.roles.add(roles.unverifiedRoleId).catch(console.error);
        }

        // Welcome message
        if (config && config.welcomeChannelId) {
            const channel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (channel) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Bienvenue sur le serveur de CODM Streamer !`)
                    .setDescription(`Salut ${member}, ravi de te voir ici ! \n\nPour accéder au reste du serveur, merci de lire et d'accepter le règlement dans <#${config.rulesChannelId || 'le salon dédié'}>.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                channel.send({ embeds: [welcomeEmbed] });
            }
        }
    },
};
