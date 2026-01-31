const { SlashCommandBuilder } = require('discord.js');
const { getExistingPlayer, playTrack } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Rejoue le morceau précédent'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', ephemeral: true });
        }

        // Note: Dans Shoukaku v4, on n'a pas de "previous" par défaut.
        // On rejoue simplement le morceau actuel depuis le début.
        if (!player.current) {
            return interaction.reply({ content: '❌ Il n\'y a pas de morceau à rejouer.', ephemeral: true });
        }

        // Redémarrer le morceau actuel depuis le début
        player.connection.seekTo(0);

        return interaction.reply({ content: '⏪ Morceau redémarré depuis le début !' });
    },
};
