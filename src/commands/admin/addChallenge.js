const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addchallenge')
        .setDescription('Ajoute un nouveau défi CODM pour le serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option.setName('title').setDescription('Le titre du défi (ex: Faire 10 kills au sniper)').setRequired(true))
        .addIntegerOption(option => option.setName('reward').setDescription('Nombre d\'XP en récompense').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Durée de validité en jours').setRequired(true)),
    async execute(interaction) {
        const title = interaction.options.getString('title');
        const reward = interaction.options.getInteger('reward');
        const duration = interaction.options.getInteger('duration');

        const guildId = interaction.guild.id;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + duration);

        await db.collection('guilds').doc(guildId).collection('challenges').add({
            title,
            rewardXp: reward,
            expiresAt: expiresAt,
            active: true,
            createdAt: new Date()
        });

        await interaction.reply({
            content: `@everyone 🎯 **Nouveau Défi disponible !**\n\n> **${title}**\n💰 Récompense : **${reward} XP**\n⏳ Expire dans ${duration} jours.\n\nUtilisez \`/defi\` pour voir tous les défis actifs !`,
        });
    },
};
