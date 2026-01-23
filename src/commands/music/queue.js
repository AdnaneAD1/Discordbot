const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const formatTime = (ms) => {
    if (isNaN(ms) || ms <= 0) return '00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts = [];
    if (hours > 0) parts.push(hours);
    parts.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
    parts.push(seconds < 10 ? `0${seconds}` : seconds);

    return parts.join(':');
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Affiche la file d\'attente actuelle'),
    async execute(interaction) {
        const player = interaction.client.kazagumo.players.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: [64] });
        }

        const queue = player.queue;
        const currentTrack = player.queue.current;

        const embed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle(`🎶 File d'attente - ${interaction.guild.name}`)
            .setThumbnail(currentTrack?.thumbnail || null);

        let description = `**En cours :**\n[${currentTrack.title}](${currentTrack.uri}) - \`${formatTime(currentTrack.length)}\`\n\n`;

        if (queue.length === 0) {
            description += "*La file d'attente est vide.*";
        } else {
            description += "**À venir :**\n";
            const tracks = queue.slice(0, 10).map((track, index) => {
                return `**${index + 1}.** [${track.title}](${track.uri}) - \`${formatTime(track.length)}\``;
            });

            description += tracks.join('\n');

            if (queue.length > 10) {
                description += `\n\n*...et ${queue.length - 10} autres morceaux.*`;
            }
        }

        const totalDuration = (currentTrack ? (currentTrack.length || 0) : 0) + queue.reduce((acc, track) => acc + (track.length || 0), 0);
        description += `\n\n**Total :** \`${queue.length + 1}\` morceau(x) | **Durée totale :** \`${formatTime(totalDuration)}\``;

        embed.setDescription(description);

        return interaction.reply({ embeds: [embed] });
    },
};
