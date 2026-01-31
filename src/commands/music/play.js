const { SlashCommandBuilder } = require('discord.js');
const { getPlayer, search, playTrack, isMusicAvailable } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Joue une musique depuis YouTube ou Spotify')
        .addStringOption(option => option.setName('query').setDescription('Nom de la musique ou lien').setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');

        // Vérifier que le système musical est disponible
        if (!isMusicAvailable()) {
            return interaction.reply({
                content: '❌ Le système musical est temporairement indisponible.',
                ephemeral: true
            });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Tu dois être dans un salon vocal !',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Rechercher la piste
            const tracks = await search(query, interaction.user);

            if (!tracks || tracks.length === 0) {
                return interaction.editReply('❌ Aucun résultat trouvé.');
            }

            // Obtenir ou créer un player
            const player = await getPlayer(interaction.guild.id, voiceChannel.id);
            player.textChannel = interaction.channel;

            const track = tracks[0];

            // Si rien ne joue, jouer directement
            if (!player.current) {
                await playTrack(player, track);
                return interaction.editReply(`🎵 **Lecture en cours :** ${track.info.title}`);
            } else {
                // Sinon ajouter à la queue
                player.addTrack(track);
                return interaction.editReply(`✅ Ajouté à la file (position ${player.queue.length}) : **${track.info.title}**`);
            }
        } catch (error) {
            console.error('[Play Command Error]', error);
            return interaction.editReply('❌ Une erreur est survenue lors de la lecture.');
        }
    },
};
