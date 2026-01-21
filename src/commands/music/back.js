const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Rejoue le morceau précédent'),
    async execute(interaction) {
        const { kazagumo } = interaction.client;
        const player = kazagumo.players.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: [64] });
        }

        if (!player.queue.previous) {
            return interaction.reply({ content: '❌ Il n\'y a pas de morceau précédent.', flags: [64] });
        }

        player.queue.unshift(player.queue.previous);
        player.skip();

        return interaction.reply({ content: '⏪ Retour au morceau précédent !' });
    },
};
