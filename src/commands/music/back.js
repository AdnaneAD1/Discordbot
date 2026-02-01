const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer, playTrack } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Rejoue le morceau précédent'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: MessageFlags.Ephemeral });
        }

        const prevTrack = player.previousTrack();
        if (!prevTrack) {
            return interaction.reply({ content: '❌ Pas de morceau précédent dans l\'historique.', flags: MessageFlags.Ephemeral });
        }

        await playTrack(player, prevTrack);
        return interaction.reply({ content: '⏪ Retour au morceau précédent !' });
    },
};
