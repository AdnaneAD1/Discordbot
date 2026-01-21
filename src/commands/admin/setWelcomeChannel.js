const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcomechannel')
        .setDescription('Définit le salon des messages de bienvenue et d\'au revoir')
        .addChannelOption(option => option.setName('channel').setDescription('Le salon à utiliser').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        await db.collection('config').doc('channels').set({ welcomeChannelId: channel.id }, { merge: true });
        await interaction.reply({ content: `✅ Salon de bienvenue défini sur <#${channel.id}>.`, ephemeral: true });
    },
};
