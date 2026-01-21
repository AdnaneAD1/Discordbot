const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Met en pause ou reprend la musique actuelle'),
    async execute(interaction) {
        const { kazagumo } = interaction.client;
        const player = kazagumo.players.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: [64] });
        }

        if (player.paused) {
            player.pause(false);
            return interaction.reply({ content: '▶️ Musique reprise !' });
        } else {
            player.pause(true);
            return interaction.reply({ content: '⏸️ Musique mise en pause.' });
        }
    },
};
