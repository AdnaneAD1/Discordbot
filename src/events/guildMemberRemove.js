const { Events, EmbedBuilder } = require('discord.js');
const { db } = require('../services/firebase');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        console.log(`Member left: ${member.user.tag}`);

        // Fetch config from Firebase
        const configRef = db.collection('config').doc('channels');
        const config = (await configRef.get()).data();

        // Goodbye message
        if (config && config.goodbyeChannelId) {
            const channel = member.guild.channels.cache.get(config.goodbyeChannelId);
            if (channel) {
                const leaveEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle(`Au revoir !`)
                    .setDescription(`**${member.user.username}** nous a quittés. À bientôt j'espère !`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                channel.send({ embeds: [leaveEmbed] });
            }
        }
    },
};
