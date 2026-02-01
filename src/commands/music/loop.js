const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer } = require('../../services/music');

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
        const player = getExistingPlayer(interaction.guild.id);
        const mode = interaction.options.getString('mode');

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: MessageFlags.Ephemeral });
        }

        player.loop = mode;

        const modeText = mode === 'none' ? 'désactivée' : (mode === 'track' ? 'du morceau actuel' : 'de la file d\'attente');
        return interaction.reply({ content: `🔁 Répétition **${modeText}** !` });
    },
};
