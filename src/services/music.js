const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Spotify = require('kazagumo-spotify');
const { db } = require('./firebase');

/**
 * =============================================
 * CONFIGURATION LAVASRC (Plugin Lavalink v4)
 * =============================================
 *
 * Si le serveur Lavalink utilise le plugin LavaSrc, les préfixes de recherche suivants sont disponibles :
 *
 * | Préfixe     | Source        | Exemple                          |
 * |-------------|---------------|----------------------------------|
 * | ytsearch:   | YouTube       | ytsearch:never gonna give you up |
 * | ytmsearch:  | YouTube Music | ytmsearch:lofi hip hop           |
 * | spsearch:   | Spotify       | spsearch:daft punk               |
 * | amsearch:   | Apple Music   | amsearch:the weeknd              |
 * | dzsearch:   | Deezer        | dzsearch:stromae                 |
 * | scsearch:   | SoundCloud    | scsearch:monstercat              |
 * | ymsearch:   | Yandex Music  | ymsearch:russian song            |
 *
 * LavaSrc utilise le "mirroring" : Spotify/Apple Music récupèrent les métadonnées
 * puis cherchent la piste sur YouTube/Deezer pour la lecture.
 *
 * Configuration requise côté Lavalink (application.yml) :
 * - plugins.lavasrc.sources.spotify: true
 * - plugins.lavasrc.spotify.clientId: "..."
 * - plugins.lavasrc.spotify.clientSecret: "..."
 */

/**
 * Configuration des nœuds Lavalink avec support multi-nœuds et fallback
 */
function getNodes() {
    const nodes = [];

    // Nœud principal
    if (process.env.LAVALINK_HOST && process.env.LAVALINK_PORT) {
        nodes.push({
            name: 'MainNode',
            url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
            auth: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: process.env.LAVALINK_SECURE === 'true'
        });
    }

    // Nœuds de backup (format: host:port:password,host2:port2:password2)
    if (process.env.LAVALINK_BACKUP_NODES) {
        const backupNodes = process.env.LAVALINK_BACKUP_NODES.split(',');
        backupNodes.forEach((nodeStr, index) => {
            const [host, port, password] = nodeStr.split(':');
            if (host && port) {
                nodes.push({
                    name: `BackupNode${index + 1}`,
                    url: `${host}:${port}`,
                    auth: password || 'youshallnotpass',
                    secure: false
                });
            }
        });
    }

    // Nœuds publics gratuits comme fallback ultime
    const publicNodes = [
        { name: 'Serenetia', url: 'lavalinkv4.serenetia.com:443', auth: 'https://dsc.gg/ajidevserver', secure: true },
        { name: 'PublicNode1', url: 'lavalink.devamop.in:443', auth: 'DevamOP', secure: true }
    ];

    // Ajouter les nœuds publics seulement si aucun nœud n'est configuré
    if (nodes.length === 0) {
        nodes.push(...publicNodes);
    }

    return nodes;
}

let kazagumo;
let nodeStatus = new Map(); // Suivi du statut des nœuds

const initMusic = (client) => {
    const nodes = getNodes();

    if (nodes.length === 0) {
        console.warn('⚠️ Aucun nœud Lavalink configuré. Le système musical sera désactivé.');
        return null;
    }

    kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube',
        plugins: [
            new Spotify({
                clientId: process.env.SPOTIFY_CLIENT_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            })
        ],
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        }
    }, new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: true,
        resume: true,
        resumeTimeout: 60,
        reconnectTries: 5,
        restTimeout: 15000,
    });

    // Événements Shoukaku (gestion des nœuds)
    kazagumo.shoukaku.on('ready', (name) => {
        console.log(`🎵 Lavalink Node "${name}" connecté.`);
        nodeStatus.set(name, { connected: true, lastError: null });
    });

    kazagumo.shoukaku.on('error', (name, error) => {
        console.error(`❌ Lavalink Node "${name}" Erreur:`, error.message);
        nodeStatus.set(name, { connected: false, lastError: error.message });
    });

    kazagumo.shoukaku.on('close', (name, code, reason) => {
        console.warn(`⚠️ Lavalink Node "${name}" déconnecté (Code: ${code})`);
        nodeStatus.set(name, { connected: false, lastError: `Déconnecté: ${reason || 'Raison inconnue'}` });
    });

    kazagumo.shoukaku.on('disconnect', (name, players, moved) => {
        console.warn(`⚠️ Lavalink Node "${name}" déconnecté. ${players.length} lecteur(s) affecté(s).`);
        if (moved) {
            console.log(`🔄 Lecteurs migrés vers un autre nœud.`);
        }
    });

    kazagumo.shoukaku.on('reconnecting', (name, left, timeout) => {
        console.log(`🔄 Tentative de reconnexion au nœud "${name}" (${left} essais restants)`);
    });

    // Événements Kazagumo (gestion des lecteurs)
    kazagumo.on('playerStart', async (player, track) => {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('music_back').setEmoji('⏮️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('music_queue').setEmoji('📝').setLabel('File').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_voteskip').setEmoji('🗳️').setLabel('Vote Skip').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Mélanger').setStyle(ButtonStyle.Secondary)
            );

        const embed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle('🎵 En lecture')
            .setDescription(`**[${track.title}](${track.uri})**`)
            .setThumbnail(track.thumbnail || null)
            .addFields(
                { name: 'Durée', value: formatTime(track.length), inline: true },
                { name: 'Auteur', value: track.author || 'Inconnu', inline: true }
            )
            .setFooter({ text: `Demandé par ${track.requester?.username || 'Inconnu'}` });

        const channel = player.data.get('message')?.channel;
        if (channel) {
            // Supprimer l'ancien message de lecture si existant
            const oldMessage = player.data.get('nowPlayingMessage');
            if (oldMessage) {
                oldMessage.delete().catch(() => { });
            }

            const newMessage = await channel.send({
                embeds: [embed],
                components: [row, row2]
            });

            player.data.set('nowPlayingMessage', newMessage);
        }
    });

    kazagumo.on('playerEnd', (player) => {
        // Réinitialiser les votes skip
        player.data.set('skipVotes', new Set());
    });

    kazagumo.on('playerEmpty', (player) => {
        const channel = player.data.get('message')?.channel;
        if (channel) {
            channel.send(`📂 La file d'attente est vide. À bientôt !`);
        }
        player.destroy();
    });

    kazagumo.on('playerDestroy', (player) => {
        // Nettoyer le message de lecture
        const oldMessage = player.data.get('nowPlayingMessage');
        if (oldMessage) {
            oldMessage.delete().catch(() => { });
        }
    });

    return kazagumo;
};

/**
 * Formate le temps en mm:ss ou hh:mm:ss
 */
function formatTime(ms) {
    if (isNaN(ms) || ms <= 0) return '00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts = [];
    if (hours > 0) parts.push(hours);
    parts.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
    parts.push(seconds < 10 ? `0${seconds}` : seconds);

    return parts.join(':');
}

/**
 * Obtient l'instance Kazagumo
 */
const getKazagumo = () => kazagumo;

/**
 * Obtient le statut des nœuds
 */
const getNodesStatus = () => {
    const status = [];
    for (const [name, data] of nodeStatus.entries()) {
        status.push({
            name,
            connected: data.connected,
            lastError: data.lastError
        });
    }
    return status;
};

/**
 * Vérifie si le système musical est disponible
 */
const isMusicAvailable = () => {
    if (!kazagumo) return false;
    return Array.from(nodeStatus.values()).some(n => n.connected);
};

// =====================
// SYSTÈME DE PLAYLISTS
// =====================

/**
 * Sauvegarde une playlist pour un serveur
 */
async function savePlaylist(guildId, userId, name, tracks) {
    try {
        const playlistRef = db.collection('guilds').doc(guildId)
            .collection('playlists').doc();

        await playlistRef.set({
            name,
            createdBy: userId,
            tracks: tracks.map(t => ({
                title: t.title,
                uri: t.uri,
                author: t.author,
                length: t.length,
                thumbnail: t.thumbnail
            })),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return { success: true, id: playlistRef.id };
    } catch (error) {
        console.error('[Music] Erreur sauvegarde playlist:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Charge une playlist
 */
async function loadPlaylist(guildId, playlistId) {
    try {
        const playlistDoc = await db.collection('guilds').doc(guildId)
            .collection('playlists').doc(playlistId).get();

        if (!playlistDoc.exists) {
            return { success: false, error: 'Playlist introuvable' };
        }

        return { success: true, playlist: playlistDoc.data() };
    } catch (error) {
        console.error('[Music] Erreur chargement playlist:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Liste les playlists d'un serveur
 */
async function getPlaylists(guildId, userId = null) {
    try {
        let query = db.collection('guilds').doc(guildId).collection('playlists');

        if (userId) {
            query = query.where('createdBy', '==', userId);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').limit(20).get();

        const playlists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, playlists };
    } catch (error) {
        console.error('[Music] Erreur liste playlists:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Supprime une playlist
 */
async function deletePlaylist(guildId, playlistId, userId) {
    try {
        const playlistRef = db.collection('guilds').doc(guildId)
            .collection('playlists').doc(playlistId);

        const playlistDoc = await playlistRef.get();

        if (!playlistDoc.exists) {
            return { success: false, error: 'Playlist introuvable' };
        }

        // Vérifier que l'utilisateur est le créateur
        if (playlistDoc.data().createdBy !== userId) {
            return { success: false, error: 'Vous ne pouvez supprimer que vos propres playlists' };
        }

        await playlistRef.delete();
        return { success: true };
    } catch (error) {
        console.error('[Music] Erreur suppression playlist:', error);
        return { success: false, error: error.message };
    }
}

// =====================
// SYSTÈME DE VOTE SKIP
// =====================

/**
 * Gère un vote skip
 * @returns {Object} { success, skipped, current, required }
 */
function handleVoteSkip(player, userId, voiceChannel) {
    if (!player || !voiceChannel) {
        return { success: false, error: 'Lecteur ou salon vocal introuvable' };
    }

    // Initialiser les votes si nécessaire
    if (!player.data.get('skipVotes')) {
        player.data.set('skipVotes', new Set());
    }

    const skipVotes = player.data.get('skipVotes');

    // Vérifier si l'utilisateur a déjà voté
    if (skipVotes.has(userId)) {
        return { success: false, error: 'Tu as déjà voté !' };
    }

    // Ajouter le vote
    skipVotes.add(userId);

    // Calculer les votes requis (50% des membres dans le vocal, minimum 2)
    const membersInVoice = voiceChannel.members.filter(m => !m.user.bot).size;
    const requiredVotes = Math.max(2, Math.ceil(membersInVoice / 2));
    const currentVotes = skipVotes.size;

    // Si assez de votes, skip
    if (currentVotes >= requiredVotes) {
        player.skip();
        player.data.set('skipVotes', new Set());
        return { success: true, skipped: true, current: currentVotes, required: requiredVotes };
    }

    return { success: true, skipped: false, current: currentVotes, required: requiredVotes };
}

// =====================
// LAVASRC SEARCH HELPERS
// =====================

/**
 * Préfixes de recherche disponibles avec LavaSrc
 */
const SEARCH_ENGINES = {
    YOUTUBE: 'ytsearch',
    YOUTUBE_MUSIC: 'ytmsearch',
    SPOTIFY: 'spsearch',
    APPLE_MUSIC: 'amsearch',
    DEEZER: 'dzsearch',
    SOUNDCLOUD: 'scsearch',
    YANDEX: 'ymsearch'
};

/**
 * Détermine le meilleur préfixe de recherche basé sur l'URL ou la requête
 * @param {string} query - La requête ou URL
 * @returns {string} - La requête avec le préfixe approprié
 */
function getSearchQuery(query) {
    // Si c'est déjà une URL, retourner tel quel
    if (query.startsWith('http://') || query.startsWith('https://')) {
        return query;
    }

    // Si un préfixe est déjà spécifié, retourner tel quel
    if (query.includes(':') && Object.values(SEARCH_ENGINES).some(prefix => query.startsWith(prefix))) {
        return query;
    }

    // Par défaut, utiliser YouTube
    return `${SEARCH_ENGINES.YOUTUBE}:${query}`;
}

/**
 * Formate une requête pour une source spécifique
 * @param {string} query - La requête
 * @param {string} source - La source (youtube, spotify, etc.)
 * @returns {string} - La requête formatée
 */
function formatSearchQuery(query, source = 'youtube') {
    const prefixes = {
        'youtube': SEARCH_ENGINES.YOUTUBE,
        'ytmusic': SEARCH_ENGINES.YOUTUBE_MUSIC,
        'spotify': SEARCH_ENGINES.SPOTIFY,
        'apple': SEARCH_ENGINES.APPLE_MUSIC,
        'deezer': SEARCH_ENGINES.DEEZER,
        'soundcloud': SEARCH_ENGINES.SOUNDCLOUD,
        'yandex': SEARCH_ENGINES.YANDEX
    };

    const prefix = prefixes[source.toLowerCase()] || SEARCH_ENGINES.YOUTUBE;
    return `${prefix}:${query}`;
}

module.exports = {
    initMusic,
    getKazagumo,
    getNodesStatus,
    isMusicAvailable,
    formatTime,
    // Playlists
    savePlaylist,
    loadPlaylist,
    getPlaylists,
    deletePlaylist,
    // Vote Skip
    handleVoteSkip,
    // LavaSrc
    SEARCH_ENGINES,
    getSearchQuery,
    formatSearchQuery
};
