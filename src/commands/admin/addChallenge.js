const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addchallenge')
        .setDescription('Ajoute un nouveau défi CODM pour le serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option.setName('title').setDescription('Le titre du défi (ex: Faire 10 kills au sniper)').setRequired(true))
        .addIntegerOption(option => option.setName('reward').setDescription('Nombre d\'XP en récompense').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('La valeur de la durée').setRequired(true))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Unité de temps')
                .setRequired(true)
                .addChoices(
                    { name: 'Secondes', value: 's' },
                    { name: 'Minutes', value: 'm' },
                    { name: 'Heures', value: 'h' },
                    { name: 'Jours', value: 'd' },
                    { name: 'Semaines', value: 'w' },
                    { name: 'Mois', value: 'M' }
                )),
    async execute(interaction) {
        const title = interaction.options.getString('title');
        const reward = interaction.options.getInteger('reward');
        const durationValue = interaction.options.getInteger('duration');
        const unit = interaction.options.getString('unit');

        const expiresAt = new Date();
        let unitText = "";

        switch (unit) {
            case 's': expiresAt.setSeconds(expiresAt.getSeconds() + durationValue); unitText = "secondes"; break;
            case 'm': expiresAt.setMinutes(expiresAt.getMinutes() + durationValue); unitText = "minutes"; break;
            case 'h': expiresAt.setHours(expiresAt.getHours() + durationValue); unitText = "heures"; break;
            case 'd': expiresAt.setDate(expiresAt.getDate() + durationValue); unitText = "jours"; break;
            case 'w': expiresAt.setDate(expiresAt.getDate() + (durationValue * 7)); unitText = "semaines"; break;
            case 'M': expiresAt.setMonth(expiresAt.getMonth() + durationValue); unitText = "mois"; break;
            default: expiresAt.setDate(expiresAt.getDate() + durationValue); unitText = "jours";
        }

        const guildId = interaction.guild.id;
        const docRef = await db.collection('guilds').doc(guildId).collection('challenges').add({
            title,
            rewardXp: reward,
            expiresAt: expiresAt,
            active: true,
            createdAt: new Date()
        });

        await interaction.reply({
            content: `@everyone 🎯 **Nouveau Défi disponible !**\n\n> **${title}**\n🆔 ID du défi : \`${docRef.id}\`\n💰 Récompense : **${reward} XP**\n⏳ Expire dans ${durationValue} ${unitText}.\n\nUtilisez \`/defi\` pour voir tous les défis actifs !`,
        });
    },
};
