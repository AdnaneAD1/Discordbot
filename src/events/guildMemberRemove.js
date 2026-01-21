const { Events, EmbedBuilder } = require('discord.js');
const { db } = require('../services/firebase');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        console.log(`Member left: ${member.user.tag}`);

        // Fetch config from Firebase
        const guildId = member.guild.id;
        const guildConfigRef = db.collection('guilds').doc(guildId).collection('config');

        const config = (await guildConfigRef.doc('channels').get()).data();
        const general = (await guildConfigRef.doc('general').get()).data() || {};
        const embedColor = general.embedColor || '#ff4757';
        const logoUrl = general.logoUrl || null;

        // Goodbye message
        if (config && config.goodbyeChannelId) {
            const channel = member.guild.channels.cache.get(config.goodbyeChannelId);
            if (channel) {
                const leaveEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`Au revoir !`)
                    .setDescription(`**${member.user.username}** nous a quittés. À bientôt j'espère !`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setTimestamp();

                channel.send({ embeds: [leaveEmbed] });
            }
        }
    },
};
