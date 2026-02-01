const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer, destroyPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Arrête la musique et fait partir le bot'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: MessageFlags.Ephemeral });
        }

        destroyPlayer(interaction.guild.id);
        await interaction.reply('🛑 Musique arrêtée et bot déconnecté.');
    },
};
