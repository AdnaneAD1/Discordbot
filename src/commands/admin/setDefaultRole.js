const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setdefaultrole')
        .setDescription('Définit le rôle donné automatiquement à l\'arrivée (ex: Novice)')
        .addRoleOption(option => option.setName('role').setDescription('Le rôle par défaut').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const guildId = interaction.guild.id;
        await db.collection('guilds').doc(guildId).collection('config').doc('roles').set({ defaultRoleId: role.id }, { merge: true });
        await interaction.reply({ content: `✅ Rôle par défaut défini sur **${role.name}**.`, ephemeral: true });
    },
};
