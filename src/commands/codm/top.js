const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Affiche le classement des meilleurs joueurs'),
    async execute(interaction) {
        const snapshot = await db.collection('users').orderBy('xp', 'desc').limit(10).get();

        if (snapshot.empty) {
            return interaction.reply({ content: 'Le classement est vide pour le moment.', ephemeral: true });
        }

        let leaderboard = "";
        let i = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            leaderboard += `${i}. **${data.username}** - ${data.xp} XP (\`${data.level}\`)\n`;
            i++;
        });

        const topEmbed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle('🏆 CLASSEMENT DES JOUEURS CODM')
            .setDescription(leaderboard)
            .setTimestamp();

        await interaction.reply({ embeds: [topEmbed] });
    },
};
