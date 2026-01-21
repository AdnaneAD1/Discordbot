const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startGiveaway } = require('../../systems/giveaways');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Lance un nouveau giveaway')
        .addStringOption(option => option.setName('prize').setDescription('Le lot à gagner').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Durée en minutes').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Nombre de gagnants'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration') * 60000;
        const winners = interaction.options.getInteger('winners') || 1;

        await startGiveaway(interaction.channel, prize, duration, winners);
        await interaction.reply({ content: '🚀 Giveaway lancé !', ephemeral: true });
    },
};
