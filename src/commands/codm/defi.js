const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActiveChallenges } = require('../../systems/challenges');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defi')
        .setDescription('Affiche les défis CODM actifs'),
    async execute(interaction) {
        const challenges = await getActiveChallenges(interaction.guild.id);

        if (challenges.length === 0) {
            return interaction.reply({ content: 'Aucun défi actif pour le moment. Repasse plus tard !', flags: [64] });
        }

        const challengeEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎯 DÉFIS CODM ACTIFS')
            .setDescription('Accomplissez ces missions pour gagner de l\'XP !')
            .setTimestamp();

        challenges.forEach(c => {
            challengeEmbed.addFields({
                name: c.title,
                value: `🆔 **ID**: \`${c.id}\`\n💰 **Récompense**: ${c.rewardXp} XP\n📅 **Expire le**: <t:${Math.floor(c.expiresAt.seconds)}:R>`
            });
        });

        await interaction.reply({ embeds: [challengeEmbed] });
    },
};
