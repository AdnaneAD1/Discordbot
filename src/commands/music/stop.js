const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Arrête la musique et fait partir le bot'),
    async execute(interaction) {
        const player = interaction.client.kazagumo.players.get(interaction.guild.id);
        if (!player) return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: [64] });

        player.destroy();
        await interaction.reply('🛑 Musique arrêtée et bot déconnecté.');
    },
};
