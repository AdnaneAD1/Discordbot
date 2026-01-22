const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un membre du serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('user').setDescription('Le membre à expulser').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('La raison')),
    async execute(interaction) {
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

        if (!member.kickable) {
            return interaction.reply({ content: 'Je ne peux pas expulser ce membre.', flags: [64] });
        }

        await member.kick(reason);

        // Log to DB
        await db.collection('mod_logs').add({
            userId: member.id,
            username: member.user.username,
            action: 'KICK',
            reason: reason,
            moderatorId: interaction.user.id,
            createdAt: new Date(),
        });

        await interaction.reply({ content: `✅ ${member.user.tag} a été expulsé avec succès.`, flags: [64] });
    },
};
