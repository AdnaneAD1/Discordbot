const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Active ou désactive la répétition')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Mode de répétition')
                .setRequired(true)
                .addChoices(
                    { name: 'Désactivé', value: 'none' },
                    { name: 'Morceau actuel', value: 'track' },
                    { name: 'File d\'attente', value: 'queue' }
                )),
    async execute(interaction) {
        const { kazagumo } = interaction.client;
        const player = kazagumo.players.get(interaction.guild.id);
        const mode = interaction.options.getString('mode');

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: [64] });
        }

        player.setLoop(mode);

        const modeText = mode === 'none' ? 'désactivée' : (mode === 'track' ? 'du morceau actuel' : 'de la file d\'attente');
        return interaction.reply({ content: `🔁 Répétition **${modeText}** !` });
    },
};
