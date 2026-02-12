const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Blackjack = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-addchips')
        .setDescription('Ajouter ou retirer des jetons à un utilisateur (Admin)')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Le joueur à créditer')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Nombre de jetons (positif pour ajouter, négatif pour retirer)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        const newBalance = await Blackjack.updateBalance(target.id, amount);

        await interaction.reply({
            content: `✅ **${amount > 0 ? 'Ajout' : 'Retrait'} effectué !**\nNouveau solde pour ${target} : **${newBalance.toLocaleString()}** 🪙`,
            flags: [64]
        });
    },
};
