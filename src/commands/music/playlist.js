const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserPlaylists, createPlaylist, addToPlaylist, deletePlaylist, getPlaylist } = require('../../services/playlistManager');
const { getPlayer, search, playTrack, isMusicAvailable } = require('../../services/music');
const { isGuildPremium } = require('../../services/subscriptions');
const { Blackjack } = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Gère tes playlists musicales personnalisées')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Affiche tes playlists'))
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Crée une nouvelle playlist')
                .addStringOption(opt => opt.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Ajoute une musique à une playlist')
                .addStringOption(opt => opt.setName('playlist').setDescription('Nom de la playlist').setRequired(true))
                .addStringOption(opt => opt.setName('query').setDescription('Lien ou nom de la musique (laisse vide pour ajouter la musique actuelle)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Joue une de tes playlists')
                .addStringOption(opt => opt.setName('playlist').setDescription('Nom de la playlist').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Supprime une playlist')
                .addStringOption(opt => opt.setName('playlist').setDescription('Nom de la playlist').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            switch (subcommand) {
                case 'list': {
                    const playlists = await getUserPlaylists(userId);
                    if (playlists.length === 0) {
                        return interaction.editReply('❌ Tu n\'as aucune playlist. Utilise `/playlist create` pour en créer une !');
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📂 Tes Playlists')
                        .setColor('#9b59b6')
                        .setDescription(playlists.map(p => `• **${p.name}** (${p.tracks?.length || 0} morceaux)`).join('\n'));

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'create': {
                    const name = interaction.options.getString('nom');

                    // Vérification Premium & Coût Création
                    const subStatus = await isGuildPremium(guildId);

                    if (!subStatus.isPremium) {
                        const COST_CREATE = 1000;
                        const balance = await Blackjack.getBalance(userId);

                        if (balance < COST_CREATE) {
                            return interaction.editReply(`❌ **Action Payante !**\nCréer une playlist coûte **${COST_CREATE}** 🪙 (Stockage à vie).\nTon solde : ${balance} 🪙.`);
                        }

                        // Prélèvement
                        await Blackjack.updateBalance(userId, -COST_CREATE);
                        await interaction.channel.send({ content: `💸 **${interaction.user.username}** a payé **${COST_CREATE}** 🪙 pour créer la playlist **${name}** !` }).catch(() => { });
                    }

                    const result = await createPlaylist(userId, name);

                    if (!result.success) {
                        return interaction.editReply(`❌ ${result.error}`);
                    }

                    return interaction.editReply(`✅ Playlist **${name}** créée avec succès !`);
                }

                case 'add': {
                    const playlistName = interaction.options.getString('playlist');
                    const query = interaction.options.getString('query');

                    const playlists = await getUserPlaylists(userId);
                    const playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

                    if (!playlist) {
                        return interaction.editReply(`❌ Playlist "**${playlistName}**" introuvable.`);
                    }

                    let trackToAdd;

                    if (query) {
                        // Rechercher la musique
                        const result = await search(query, interaction.user);
                        if (!result.tracks || result.tracks.length === 0) {
                            return interaction.editReply('❌ Aucun résultat trouvé pour ta recherche.');
                        }
                        trackToAdd = result.tracks[0];
                    } else {
                        // Ajouter la musique actuelle
                        const player = await getPlayer(guildId);
                        if (!player || !player.current) {
                            return interaction.editReply('❌ Aucune musique en cours de lecture à ajouter.');
                        }
                        trackToAdd = player.current;
                    }

                    const result = await addToPlaylist(userId, playlist.id, trackToAdd);
                    if (!result.success) {
                        return interaction.editReply(`❌ ${result.error}`);
                    }

                    return interaction.editReply(`✅ Ajouté **${trackToAdd.info.title}** à la playlist **${playlist.name}** !`);
                }

                case 'play': {
                    if (!isMusicAvailable()) {
                        return interaction.editReply('❌ Le système musical est indisponible.');
                    }

                    // Vérification Premium & Coût Lecture
                    const subStatus = await isGuildPremium(guildId);

                    if (!subStatus.isPremium) {
                        const COST_PLAY = 200;
                        const balance = await Blackjack.getBalance(userId);

                        if (balance < COST_PLAY) {
                            return interaction.editReply(`❌ **Action Payante !**\nLancer une playlist coûte **${COST_PLAY}** 🪙.\nTon solde : ${balance} 🪙.`);
                        }

                        // Prélèvement
                        await Blackjack.updateBalance(userId, -COST_PLAY);
                        // Notification discrète
                    }

                    const playlistName = interaction.options.getString('playlist');
                    const playlists = await getUserPlaylists(userId);
                    const playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

                    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
                        return interaction.editReply('❌ Cette playlist est vide ou introuvable.');
                    }

                    const voiceChannel = interaction.member.voice.channel;
                    if (!voiceChannel) {
                        return interaction.editReply('❌ Tu dois être dans un salon vocal !');
                    }

                    const player = await getPlayer(guildId, voiceChannel.id);
                    player.textChannel = interaction.channel;

                    interaction.editReply(`⏳ Chargement de la playlist **${playlist.name}** (${playlist.tracks.length} morceaux)...`);

                    let count = 0;
                    for (const trackInfo of playlist.tracks) {
                        try {
                            const res = await search(trackInfo.uri || trackInfo.title, interaction.user);
                            if (res.tracks && res.tracks.length > 0) {
                                player.addTrack(res.tracks[0]);
                                count++;
                            }
                        } catch (e) { console.error(e); }
                    }

                    if (count === 0) {
                        return interaction.followUp({ content: '❌ Impossible de charger les musiques de cette playlist.', flags: MessageFlags.Ephemeral });
                    }

                    if (!player.current) {
                        const firstTrack = player.nextTrack();
                        if (firstTrack) await playTrack(player, firstTrack);
                    }

                    return interaction.followUp({
                        content: `🎶 Mise en lecture de **${playlist.name}** (${count} morceaux ajoutés au total) !`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                case 'delete': {
                    const playlistName = interaction.options.getString('playlist');
                    const playlists = await getUserPlaylists(userId);
                    const playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

                    if (!playlist) {
                        return interaction.editReply(`❌ Playlist "**${playlistName}**" introuvable.`);
                    }

                    await deletePlaylist(userId, playlist.id);
                    return interaction.editReply(`✅ Playlist **${playlist.name}** supprimée.`);
                }
            }
        } catch (error) {
            console.error('[Playlist Command Error]', error);
            return interaction.editReply('❌ Une erreur est survenue lors de l\'exécution de la commande.');
        }
    }
};
