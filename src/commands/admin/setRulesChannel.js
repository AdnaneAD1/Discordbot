const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setruleschannel')
        .setDescription('Définit le salon règlement pour le mentionner dans le bienvenue')
        .addChannelOption(option => option.setName('channel').setDescription('Le salon règlement').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        await db.collection('config').doc('channels').set({ rulesChannelId: channel.id }, { merge: true });
        await interaction.reply({ content: `✅ Salon règlement défini sur <#${channel.id}>.`, ephemeral: true });
    },
};
