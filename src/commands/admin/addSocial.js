const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addsocial')
        .setDescription('Ajoute un compte social pour les notifications')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('La plateforme (Twitch, YouTube, TikTok)')
                .setRequired(true)
                .addChoices(
                    { name: 'Twitch', value: 'Twitch' },
                    { name: 'YouTube', value: 'YouTube' },
                    { name: 'TikTok', value: 'TikTok' }
                ))
        .addStringOption(option => option.setName('username').setDescription('Nom d\'utilisateur ou ID de chaîne').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Le salon pour les annonces').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const platform = interaction.options.getString('platform');
        const username = interaction.options.getString('username');
        const channel = interaction.options.getChannel('channel');

        const guildId = interaction.guild.id;
        await db.collection('socials').add({
            platform,
            username,
            channelId: channel.id,
            guildId,
            lastPostId: '',
            isLive: false,
            createdAt: new Date()
        });

        await interaction.reply({ content: `✅ Compte **${platform}** (${username}) ajouté ! Les notifications seront envoyées dans <#${channel.id}>.`, ephemeral: true });
    },
};
