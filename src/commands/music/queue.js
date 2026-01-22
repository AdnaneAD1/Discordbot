const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

        let description = `**En cours :**\n[${currentTrack.title}](${currentTrack.uri}) - \`${interaction.client.kazagumo.utils.formatTime(currentTrack.length)}\`\n\n`;

        if (queue.length === 0) {
            description += "*La file d'attente est vide.*";
        } else {
            description += "**À venir :**\n";
            const tracks = queue.slice(0, 10).map((track, index) => {
                return `**${index + 1}.** [${track.title}](${track.uri}) - \`${interaction.client.kazagumo.utils.formatTime(track.length)}\``;
            });

            description += tracks.join('\n');

            if (queue.length > 10) {
                description += `\n\n*...et ${queue.length - 10} autres morceaux.*`;
            }
        }

        description += `\n\n**Total :** \`${queue.length + 1}\` morceau(x) | **Durée totale :** \`${interaction.client.kazagumo.utils.formatTime(player.queue.duration)}\``;

        embed.setDescription(description);

        return interaction.reply({ embeds: [embed] });
    },
};
