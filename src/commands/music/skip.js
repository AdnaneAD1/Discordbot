const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Passe à la musique suivante'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: MessageFlags.Ephemeral });
        }

        // Stopper la piste actuelle, le handler 'end' jouera la suivante
        player.connection.stopTrack();
        await interaction.reply('⏭️ Musique passée !');
    },
};
