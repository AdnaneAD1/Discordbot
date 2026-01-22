const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setgoodbyechannel')
        .setDescription('Définit le salon des messages d\'au revoir')
        .addChannelOption(option => option.setName('channel').setDescription('Le salon à utiliser').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;
        await db.collection('guilds').doc(guildId).collection('config').doc('channels').set({ goodbyeChannelId: channel.id }, { merge: true });
        await interaction.reply({ content: `✅ Salon de départ défini sur <#${channel.id}>.`, flags: [64] });
    },
};
