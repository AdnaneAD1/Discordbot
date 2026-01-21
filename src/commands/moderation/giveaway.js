const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startGiveaway } = require('../../systems/giveaways');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Lance un nouveau giveaway')
        .addStringOption(option => option.setName('prize').setDescription('Le lot à gagner').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Durée en minutes').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Nombre de gagnants'))
        .addBooleanOption(option => option.setName('top_10').setDescription('Limiter la participation au Top 10 du classement XP'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration') * 60000;
        const winners = interaction.options.getInteger('winners') || 1;
        const top10Only = interaction.options.getBoolean('top_10') || false;

        const guildId = interaction.guild.id;
        const channelConfig = await db.collection('guilds').doc(guildId).collection('config').doc('channels').get();
        let targetChannel = interaction.channel;

        if (channelConfig.exists && channelConfig.data().giveawayChannelId) {
            const configChannel = interaction.guild.channels.cache.get(channelConfig.data().giveawayChannelId);
            if (configChannel) targetChannel = configChannel;
        }

        await startGiveaway(targetChannel, prize, duration, winners, top10Only);
        await interaction.reply({
            content: `🚀 Giveaway lancé dans le salon <#${targetChannel.id}> ! @everyone`,
            ephemeral: false
        });
    },
};
