const { SlashCommandBuilder } = require('discord.js');
const { getExistingPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Met en pause ou reprend la musique actuelle'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', ephemeral: true });
        }

        const isPaused = player.connection.paused;

        if (isPaused) {
            player.connection.setPaused(false);
            return interaction.reply({ content: '▶️ Musique reprise !' });
        } else {
            player.connection.setPaused(true);
            return interaction.reply({ content: '⏸️ Musique mise en pause.' });
        }
    },
};
