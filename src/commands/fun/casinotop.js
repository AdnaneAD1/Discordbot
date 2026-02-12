const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Blackjack = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casinotop')
        .setDescription('Affiche le Top 10 des joueurs les plus riches du Sigma Palace 🏆'),

    async execute(interaction) {
        await interaction.deferReply();

        const topPlayers = await Blackjack.getLeaderboard();

        const embed = new EmbedBuilder()
            .setTitle('🏆 SIGMA PALACE - LEADERBOARD')
            .setColor('#febc11')
            .setDescription('Voici les 10 plus gros parieurs du serveur !')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png');

        let leaderboardText = '';

        for (let i = 0; i < topPlayers.length; i++) {
            const player = topPlayers[i];
            let member;
            try {
                member = await interaction.guild.members.fetch(player.id);
            } catch (e) {
                member = null;
            }

            const name = member ? member.displayName : `Utilisateur inconnu (${player.id})`;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';

            leaderboardText += `${medal} **${name}** : \`${player.chips.toLocaleString()}\` 🪙\n`;
        }

        embed.addFields({ name: 'Classement', value: leaderboardText || 'Aucun joueur pour le moment.' });
        embed.setFooter({ text: 'Viens tenter ta chance pour monter au sommet ! 🎰' });

        await interaction.editReply({ embeds: [embed] });
    },
};
