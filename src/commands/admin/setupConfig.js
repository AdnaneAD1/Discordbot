const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupconfig')
        .setDescription('Configure les salons et rôles du bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => option.setName('welcome_channel').setDescription('Salon pour les messages de bienvenue'))
        .addChannelOption(option => option.setName('rules_channel').setDescription('Salon pour le règlement'))
        .addRoleOption(option => option.setName('unverified_role').setDescription('Rôle pour les nouveaux (non vérifiés)'))
        .addRoleOption(option => option.setName('member_role').setDescription('Rôle pour les membres vérifiés')),
    async execute(interaction) {
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const rulesChannel = interaction.options.getChannel('rules_channel');
        const unverifiedRole = interaction.options.getRole('unverified_role');
        const memberRole = interaction.options.getRole('member_role');

        const updates = [];

        if (welcomeChannel) {
            await db.collection('config').doc('channels').set({ welcomeChannelId: welcomeChannel.id }, { merge: true });
            updates.push(`✅ Salon Bienvenue : <#${welcomeChannel.id}>`);
        }

        if (rulesChannel) {
            await db.collection('config').doc('channels').set({ rulesChannelId: rulesChannel.id }, { merge: true });
            updates.push(`✅ Salon Règlement : <#${rulesChannel.id}>`);
        }

        if (unverifiedRole) {
            await db.collection('config').doc('roles').set({ unverifiedRoleId: unverifiedRole.id }, { merge: true });
            updates.push(`✅ Rôle Non-Vérifié : <@&${unverifiedRole.id}>`);
        }

        if (memberRole) {
            await db.collection('config').doc('roles').set({ memberRoleId: memberRole.id }, { merge: true });
            updates.push(`✅ Rôle Membre : <@&${memberRole.id}>`);
        }

        if (updates.length === 0) {
            return interaction.reply({ content: '❌ Merci de spécifier au moins une option à configurer.', ephemeral: true });
        }

        const setupEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('⚙️ CONFIGURATION MISE À JOUR')
            .setDescription(updates.join('\n'))
            .setTimestamp();

        await interaction.reply({ embeds: [setupEmbed] });
    },
};
