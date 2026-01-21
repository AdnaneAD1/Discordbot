const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setunverifiedrole')
        .setDescription('Définit le rôle donné automatiquement à l\'arrivée')
        .addRoleOption(option => option.setName('role').setDescription('Le rôle non-vérifié').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        await db.collection('config').doc('roles').set({ unverifiedRoleId: role.id }, { merge: true });
        await interaction.reply({ content: `✅ Rôle non-vérifié défini sur **${role.name}**.`, ephemeral: true });
    },
};
