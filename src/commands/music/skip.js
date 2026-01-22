const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Passe à la musique suivante'),
    async execute(interaction) {
        const player = interaction.client.kazagumo.players.get(interaction.guild.id);
        if (!player) return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: [64] });

        player.skip();
        await interaction.reply('⏭️ Musique passée !');
    },
};
