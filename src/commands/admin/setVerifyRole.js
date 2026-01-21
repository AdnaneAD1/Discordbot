const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setverifyrole')
        .setDescription('Définit le rôle donné après avoir accepté le règlement')
        .addRoleOption(option => option.setName('role').setDescription('Le rôle de membre vérifié').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        await db.collection('config').doc('roles').set({ memberRoleId: role.id }, { merge: true });
        await interaction.reply({ content: `✅ Rôle de membre vérifié défini sur **${role.name}**.`, ephemeral: true });
    },
};
