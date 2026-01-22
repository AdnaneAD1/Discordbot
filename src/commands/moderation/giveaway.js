const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startGiveaway } = require('../../systems/giveaways');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Lance un nouveau giveaway')
        .addStringOption(option => option.setName('prize').setDescription('Le lot à gagner').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('La valeur de la durée').setRequired(true))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Unité de temps')
                .setRequired(true)
                .addChoices(
                    { name: 'Secondes', value: 's' },
                    { name: 'Minutes', value: 'm' },
                    { name: 'Heures', value: 'h' },
                    { name: 'Jours', value: 'd' },
                    { name: 'Semaines', value: 'w' },
                    { name: 'Mois', value: 'M' }
                ))
        .addIntegerOption(option => option.setName('winners').setDescription('Nombre de gagnants'))
        .addBooleanOption(option => option.setName('top_10').setDescription('Limiter la participation au Top 10 du classement XP'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const prize = interaction.options.getString('prize');
        const durationValue = interaction.options.getInteger('duration');
        const unit = interaction.options.getString('unit');
        const winners = interaction.options.getInteger('winners') || 1;
        const top10Only = interaction.options.getBoolean('top_10') || false;

        let durationMs;
        switch (unit) {
            case 's': durationMs = durationValue * 1000; break;
            case 'm': durationMs = durationValue * 60000; break;
            case 'h': durationMs = durationValue * 3600000; break;
            case 'd': durationMs = durationValue * 86400000; break;
            case 'w': durationMs = durationValue * 604800000; break;
            case 'M': durationMs = durationValue * 2592000000; break;
            default: durationMs = durationValue * 60000;
        }

        const guildId = interaction.guild.id;
        const channelConfig = await db.collection('guilds').doc(guildId).collection('config').doc('channels').get();
        let targetChannel = interaction.channel;

        if (channelConfig.exists && channelConfig.data().giveawayChannelId) {
            const configChannel = interaction.guild.channels.cache.get(channelConfig.data().giveawayChannelId);
            if (configChannel) targetChannel = configChannel;
        }

        await startGiveaway(targetChannel, prize, durationMs, winners, top10Only);
        await interaction.reply({
            content: `🚀 Giveaway lancé dans le salon <#${targetChannel.id}> ! @everyone`,
            flags: [64]
        });
    },
};
