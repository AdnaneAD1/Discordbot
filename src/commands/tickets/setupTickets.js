const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuptickets')
        .setDescription('Affiche le panneau de création de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const ticketEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🎫 CENTRE DE SUPPORT')
            .setDescription(
                'Besoin d\'aide ? Choisissez la catégorie correspondante ci-dessous :\n\n' +
                '🛠️ **SUPPORT** : Problème technique ou question générale.\n' +
                '🏆 **TOURNOI** : Question concernant un tournoi CODM.\n' +
                '🏷️ **RÔLE** : Demande de rôle spécifique.'
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('ticket_support').setLabel('🛠️ Support').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_tournament').setLabel('🏆 Tournoi').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_role').setLabel('🏷️ Rôle').setStyle(ButtonStyle.Success),
            );

        await interaction.reply({ embeds: [ticketEmbed], components: [row] });
    },
};
