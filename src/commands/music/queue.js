const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer, formatTime } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Affiche la file d\'attente actuelle'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: MessageFlags.Ephemeral });
        }

        const currentTrack = player.current;
        const queue = player.queue;

        const embed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle(`🎶 File d'attente - ${interaction.guild.name}`)
            .setThumbnail(currentTrack?.info?.artworkUrl || null);

        let description = '';

        if (currentTrack) {
            description += `**En cours :**\n[${currentTrack.info.title}](${currentTrack.info.uri}) - \`${formatTime(currentTrack.info.length)}\`\n\n`;
        }

        if (queue.length === 0) {
            description += "*La file d'attente est vide.*";
        } else {
            description += "**À venir :**\n";
            const tracks = queue.slice(0, 10).map((track, index) => {
                return `**${index + 1}.** [${track.info.title}](${track.info.uri}) - \`${formatTime(track.info.length)}\``;
            });

            description += tracks.join('\n');

            if (queue.length > 10) {
                description += `\n\n*...et ${queue.length - 10} autres morceaux.*`;
            }
        }

        const totalDuration = (currentTrack ? (currentTrack.info.length || 0) : 0) +
            queue.reduce((acc, track) => acc + (track.info?.length || 0), 0);
        description += `\n\n**Total :** \`${queue.length + (currentTrack ? 1 : 0)}\` morceau(x) | **Durée totale :** \`${formatTime(totalDuration)}\``;

        embed.setDescription(description);

        return interaction.reply({ embeds: [embed] });
    },
};
