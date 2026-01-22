const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un membre du serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => option.setName('user').setDescription('Le membre à bannir').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('La raison')),
    async execute(interaction) {
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

        if (!member.bannable) {
            return interaction.reply({ content: 'Je ne peux pas bannir ce membre.', flags: [64] });
        }

        await member.ban({ reason });

        // Log to DB
        await db.collection('mod_logs').add({
            userId: member.id,
            username: member.user.username,
            action: 'BAN',
            reason: reason,
            moderatorId: interaction.user.id,
            createdAt: new Date(),
        });

        await interaction.reply({ content: `✅ ${member.user.tag} a été banni avec succès.`, flags: [64] });
    },
};
