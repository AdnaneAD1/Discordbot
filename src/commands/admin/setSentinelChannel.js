const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setsentinelchannel')
        .setDescription('Définit le salon où l\'IA Sentinel enverra les alertes de toxicité')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le salon d\'alerte')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        await db.collection('guilds').doc(guildId).collection('config').doc('moderation').set({
            alertChannelId: channel.id
        }, { merge: true });

        await interaction.reply({
            content: `✅ Salon d'alerte Sentinel défini sur <#${channel.id}> !`,
            flags: [64]
        });
    },
};
