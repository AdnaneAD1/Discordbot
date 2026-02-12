const { Shoukaku, Connectors } = require('shoukaku');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { db } = require('./firebase');
const { isGuildPremium } = require('./subscriptions');

/**
 * =============================================
 * CONFIGURATION LAVALINK v4 avec SHOUKAKU v4
 * =============================================
 */

/**
 * Configuration des nœuds Lavalink avec support multi-nœuds et fallback
 */
function getNodes() {
    const nodes = [];

    // Nœud principal depuis les variables d'environnement
    if (process.env.LAVALINK_HOST && process.env.LAVALINK_PORT) {
        nodes.push({
            name: 'CustomMainNode',
            url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
            auth: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: process.env.LAVALINK_SECURE === 'true'
        });
    }

    // Nœuds publics gratuits comme fallback (Pool de secours)
    const publicNodes = [
        { name: 'Serenetia-S', url: 'lavalinkv4.serenetia.com:443', auth: 'https://dsc.gg/ajidevserver', secure: true },
        { name: 'Serenetia-WS', url: 'lavalinkv4.serenetia.com:80', auth: 'https://dsc.gg/ajidevserver', secure: false },
        { name: 'Serenetia-Fallback', url: 'lavalink.serenetia.com:443', auth: 'https://dsc.gg/ajidevserver', secure: true },
        { name: 'Trinium', url: 'lavalink.triniumhost.com:4333', auth: 'free', secure: false },
        { name: 'Jirayu', url: 'lavalink.jirayu.net:443', auth: 'youshallnotpass', secure: true }
    ];

    // On ajoute toujours les nœuds publics en secours, même si un nœud custom est présent
    // Shoukaku choisira intelligemment le meilleur nœud (L'idéal)
    nodes.push(...publicNodes);

    return nodes;
}

let shoukaku;
let nodeStatus = new Map();
let currentStickyNodeName = null;

/**
 * Récupère le meilleur nœud "sticky" (récupère le premier disponible et y reste)
 */
function getStickyNode() {
    if (!shoukaku) return null;

    // Si on a déjà un nœud sélectionné et qu'il est connecté, on le garde
    if (currentStickyNodeName) {
        const node = shoukaku.nodes.get(currentStickyNodeName);
        if (node && node.state === 1) { // 1 = CONNECTED
            return node;
        }
    }

    // Sinon, on cherche le premier nœud connecté dans l'ordre de priorité
    const nodes = Array.from(shoukaku.nodes.values());
    const connectedNode = nodes.find(n => n.state === 1);

    if (connectedNode) {
        currentStickyNodeName = connectedNode.name;
        console.log(`🎯 Nouveau nœud sticky sélectionné : ${currentStickyNodeName}`);
        return connectedNode;
    }

    return null;
}

// Stockage des players personnalisés avec queue et metadata
const players = new Map();

/**
 * Classe Player personnalisée pour gérer la queue et les métadonnées
 */
class MusicPlayer {
    constructor(guildId, connection) {
        this.guildId = guildId;
        this.connection = connection;
        this.queue = [];
        this.history = []; // Stockage des morceaux déjà joués
        this.current = null;
        this.loop = 'none'; // 'none', 'track', 'queue'
        this.volume = 100;
        this.textChannel = null;
        this.nowPlayingMessage = null;
        this.skipVotes = new Set();
    }

    addTrack(track) {
        this.queue.push(track);
    }

    nextTrack() {
        if (this.current && this.loop !== 'track') {
            this.history.push(this.current);
            // Limiter l'historique aux 50 derniers morceaux
            if (this.history.length > 50) this.history.shift();
        }

        if (this.loop === 'track' && this.current) {
            return this.current;
        }
        if (this.loop === 'queue' && this.current) {
            this.queue.push(this.current);
        }
        this.current = this.queue.shift() || null;
        return this.current;
    }

    previousTrack() {
        if (this.history.length === 0) return null;

        // Si quelque chose joue, on le remet en début de queue
        if (this.current) {
            this.queue.unshift(this.current);
        }

        // On récupère le dernier morceau de l'historique
        this.current = this.history.pop();
        return this.current;
    }

    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    clear() {
        this.queue = [];
        this.current = null;
    }
}

const initMusic = (client) => {
    const nodes = getNodes();

    if (nodes.length === 0) {
        console.warn('⚠️ Aucun nœud Lavalink configuré. Le système musical sera désactivé.');
        return null;
    }

    shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: true,
        resume: true,
        resumeTimeout: 60,
        reconnectTries: 5,
        restTimeout: 15000,
    });

    // Événements Shoukaku (gestion des nœuds)
    shoukaku.on('ready', (name) => {
        console.log(`🎵 Lavalink Node "${name}" connecté.`);
        nodeStatus.set(name, { connected: true, lastError: null });
    });

    shoukaku.on('error', (name, error) => {
        console.error(`❌ Lavalink Node "${name}" Erreur:`, error.message);
        nodeStatus.set(name, { connected: false, lastError: error.message });
    });

    shoukaku.on('close', (name, code, reason) => {
        console.warn(`⚠️ Lavalink Node "${name}" déconnecté (Code: ${code})`);
        nodeStatus.set(name, { connected: false, lastError: `Déconnecté: ${reason || 'Raison inconnue'}` });
    });

    shoukaku.on('disconnect', (name, playersMoved, moved) => {
        console.warn(`⚠️ Lavalink Node "${name}" déconnecté. ${playersMoved.length} lecteur(s) affecté(s).`);
        if (moved) {
            console.log(`🔄 Lecteurs migrés vers un autre nœud.`);
        }
    });

    shoukaku.on('reconnecting', (name, info) => {
        console.log(`🔄 Tentative de reconnexion au nœud "${name}" (${info})`);
    });

    return shoukaku;
};

/**
 * Crée ou récupère un player pour un serveur
 */
async function getPlayer(guildId, channelId) {
    if (players.has(guildId)) {
        return players.get(guildId);
    }

    const node = getStickyNode() || shoukaku.getIdealNode();
    if (!node) {
        throw new Error('Aucun nœud Lavalink disponible');
    }

    const connection = await shoukaku.joinVoiceChannel({
        guildId: guildId,
        channelId: channelId,
        shardId: 0,
        deaf: true
    });

    const player = new MusicPlayer(guildId, connection);
    players.set(guildId, player);

    // Gérer la fin d'une piste
    connection.on('end', async (data) => {
        if (data.reason === 'replaced') return;

        const nextTrack = player.nextTrack();
        if (nextTrack) {
            await playTrack(player, nextTrack);
        } else {
            // File vide
            if (player.textChannel) {
                player.textChannel.send('📂 La file d\'attente est vide. À bientôt !').catch(() => { });
            }
            destroyPlayer(guildId);
        }
    });

    // Gérer la déconnexion
    connection.on('closed', (data) => {
        console.warn(`⚠️ Connexion vocale fermée pour ${guildId}:`, data.reason);
        destroyPlayer(guildId);
    });

    connection.on('error', (error) => {
        console.error(`❌ Erreur player ${guildId}:`, error);
    });

    return player;
}

/**
 * Joue une piste
 */
async function playTrack(player, track) {
    player.current = track;
    player.skipVotes = new Set();

    await player.connection.playTrack({ track: { encoded: track.encoded } });

    // Envoyer l'embed "En lecture"
    if (player.textChannel) {
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
                new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Aléatoire').setStyle(ButtonStyle.Secondary)
            );

        const embed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle('🎵 En lecture')
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .setThumbnail(track.info.artworkUrl || null)
            .addFields(
                { name: 'Durée', value: formatTime(track.info.length), inline: true },
                { name: 'Artiste', value: track.info.author || 'Inconnu', inline: true }
            )
            .setFooter({ text: `Demandé par ${track.requester?.username || 'Inconnu'}` });

        // Supprimer l'ancien message
        if (player.nowPlayingMessage) {
            player.nowPlayingMessage.delete().catch(() => { });
        }

        // Vérifier le premium pour l'affichage
        const premiumStatus = await isGuildPremium(player.guildId);

        if (!premiumStatus.isPremium) {
            // Affichage simplifié "Clean Mode" pour les non-Premium
            player.nowPlayingMessage = await player.textChannel.send({
                content: `🎵 **En train de jouer : [${track.info.title}](${track.info.uri})** 🎧`,
                components: [row] // Uniquement la première rangée (contrôles principaux)
            }).catch(() => null);
        } else {
            // Affichage avec Embed pour les premium
            player.nowPlayingMessage = await player.textChannel.send({
                embeds: [embed],
                components: [row, row2]
            }).catch(() => null);
        }
    }
}

/**
 * Recherche des pistes (Gère Lavalink v4 avec Retry sur plusieurs nœuds)
 */
async function search(query, requester) {
    const nodes = Array.from(shoukaku.nodes.values()).filter(n => n.state === 1); // Uniquement les nœuds connectés
    if (nodes.length === 0) {
        throw new Error('Aucun nœud Lavalink disponible');
    }

    // On trie pour mettre le nœud sticky en premier s'il existe
    const stickyNode = getStickyNode();
    const sortedNodes = nodes.sort((a, b) => (a.name === stickyNode?.name ? -1 : 1));

    const searchQuery = getSearchQuery(query);
    let lastError = null;

    // Tentative sur chaque nœud disponible jusqu'à ce qu'un fonctionne
    for (const node of sortedNodes) {
        try {
            const result = await node.rest.resolve(searchQuery);

            if (!result || result.loadType === 'empty') continue;
            if (result.loadType === 'error') {
                console.error(`[Music] Erreur sur le nœud ${node.name}:`, result.data);
                continue;
            }

            let tracks = [];
            let playlistInfo = null;

            if (result.loadType === 'playlist') {
                tracks = result.data.tracks;
                playlistInfo = result.data.info;
            } else if (result.loadType === 'track') {
                tracks = [result.data];
            } else if (result.loadType === 'search') {
                tracks = result.data;
            }

            if (tracks.length > 0) {
                const formattedTracks = tracks.map(track => ({
                    ...track,
                    requester
                }));
                return { loadType: result.loadType, tracks: formattedTracks, playlistInfo };
            }
        } catch (error) {
            console.error(`[Music] Échec de recherche sur le nœud ${node.name}:`, error.message || error);
            lastError = error;
        }
    }

    if (lastError) throw lastError;
    return { loadType: 'empty', tracks: [] };
}

/**
 * Détruit un player
 */
function destroyPlayer(guildId) {
    const player = players.get(guildId);
    if (player) {
        if (player.nowPlayingMessage) {
            player.nowPlayingMessage.delete().catch(() => { });
        }
        players.delete(guildId);
    }
    shoukaku.leaveVoiceChannel(guildId);
}

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
 * Obtient l'instance Shoukaku
 */
const getShoukaku = () => shoukaku;

/**
 * Obtient un player existant
 */
const getExistingPlayer = (guildId) => players.get(guildId);

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
    if (!shoukaku) return false;
    return Array.from(nodeStatus.values()).some(n => n.connected);
};

// =====================
// SYSTÈME DE PLAYLISTS
// =====================

async function savePlaylist(guildId, userId, name, tracks) {
    try {
        const playlistRef = db.collection('guilds').doc(guildId)
            .collection('playlists').doc();

        await playlistRef.set({
            name,
            createdBy: userId,
            tracks: tracks.map(t => ({
                title: t.info?.title || t.title,
                uri: t.info?.uri || t.uri,
                author: t.info?.author || t.author,
                length: t.info?.length || t.length,
                artworkUrl: t.info?.artworkUrl || t.thumbnail
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

async function deletePlaylist(guildId, playlistId, userId) {
    try {
        const playlistRef = db.collection('guilds').doc(guildId)
            .collection('playlists').doc(playlistId);

        const playlistDoc = await playlistRef.get();

        if (!playlistDoc.exists) {
            return { success: false, error: 'Playlist introuvable' };
        }

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

function handleVoteSkip(player, userId, voiceChannel) {
    if (!player || !voiceChannel) {
        return { success: false, error: 'Lecteur ou salon vocal introuvable' };
    }

    if (player.skipVotes.has(userId)) {
        return { success: false, error: 'Tu as déjà voté !' };
    }

    player.skipVotes.add(userId);

    const membersInVoice = voiceChannel.members.filter(m => !m.user.bot).size;
    const requiredVotes = Math.max(2, Math.ceil(membersInVoice / 2));
    const currentVotes = player.skipVotes.size;

    if (currentVotes >= requiredVotes) {
        player.connection.stopTrack();
        player.skipVotes = new Set();
        return { success: true, skipped: true, current: currentVotes, required: requiredVotes };
    }

    return { success: true, skipped: false, current: currentVotes, required: requiredVotes };
}

// =====================
// SEARCH HELPERS
// =====================

const SEARCH_ENGINES = {
    YOUTUBE: 'ytsearch',
    YOUTUBE_MUSIC: 'ytmsearch',
    SPOTIFY: 'spsearch',
    SOUNDCLOUD: 'scsearch',
    DEEZER: 'dzsearch'
};

function getSearchQuery(query) {
    if (query.startsWith('http://') || query.startsWith('https://')) {
        return query;
    }
    if (query.includes(':') && Object.values(SEARCH_ENGINES).some(prefix => query.startsWith(prefix))) {
        return query;
    }
    return `${SEARCH_ENGINES.YOUTUBE}:${query}`;
}

function formatSearchQuery(query, source = 'youtube') {
    const prefixes = {
        'youtube': SEARCH_ENGINES.YOUTUBE,
        'ytmusic': SEARCH_ENGINES.YOUTUBE_MUSIC,
        'spotify': SEARCH_ENGINES.SPOTIFY,
        'soundcloud': SEARCH_ENGINES.SOUNDCLOUD,
        'deezer': SEARCH_ENGINES.DEEZER,
        'applemusic': SEARCH_ENGINES.APPLE_MUSIC
    };

    const prefix = prefixes[source.toLowerCase()] || SEARCH_ENGINES.YOUTUBE;
    return `${prefix}:${query}`;
}

module.exports = {
    initMusic,
    getShoukaku,
    getPlayer,
    getExistingPlayer,
    destroyPlayer,
    search,
    playTrack,
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
    // Search
    SEARCH_ENGINES,
    getSearchQuery,
    formatSearchQuery,
    // Backward compatibility
    getKazagumo: getShoukaku
};
