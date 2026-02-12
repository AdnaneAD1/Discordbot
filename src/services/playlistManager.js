const { db } = require('./firebase');
const { SUBSCRIPTION_TIERS, getUserSubscription } = require('./subscriptions');

/**
 * Service de gestion des playlists utilisateur
 */

/**
 * Récupère toutes les playlists d'un utilisateur
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
async function getUserPlaylists(userId) {
    const playlistsRef = db.collection('users').doc(userId).collection('playlists');
    const snapshot = await playlistsRef.get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Crée une nouvelle playlist
 * @param {string} userId 
 * @param {string} name 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createPlaylist(userId, name) {
    const playlists = await getUserPlaylists(userId);
    const subscription = await getUserSubscription(userId);

    // Vérifier les limites selon le tier
    const features = subscription.tier.features;
    const maxPlaylists = features.maxPlaylists || 3; // Par défaut 3 pour Free

    if (maxPlaylists !== -1 && playlists.length >= maxPlaylists) {
        return {
            success: false,
            error: `Tu as atteint la limite de ${maxPlaylists} playlists pour ton abonnement (${subscription.tier.name}).`
        };
    }

    // Vérifier si le nom existe déjà
    if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, error: 'Une playlist avec ce nom existe déjà.' };
    }

    const playlistsRef = db.collection('users').doc(userId).collection('playlists');
    await playlistsRef.add({
        name,
        tracks: [],
        createdAt: new Date()
    });

    return { success: true };
}

/**
 * Ajoute une piste à une playlist
 * @param {string} userId 
 * @param {string} playlistId 
 * @param {Object} trackData 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function addToPlaylist(userId, playlistId, trackData) {
    const playlistRef = db.collection('users').doc(userId).collection('playlists').doc(playlistId);
    const doc = await playlistRef.get();

    if (!doc.exists) {
        return { success: false, error: 'Playlist introuvable.' };
    }

    const data = doc.data();
    const tracks = data.tracks || [];

    // On ne stocke que les infos nécessaires pour re-jouer (uri ou identifiant)
    tracks.push({
        title: trackData.info.title,
        uri: trackData.info.uri,
        author: trackData.info.author,
        length: trackData.info.length,
        addedAt: new Date()
    });

    await playlistRef.update({ tracks });

    return { success: true };
}

/**
 * Supprime une playlist
 * @param {string} userId 
 * @param {string} playlistId 
 */
async function deletePlaylist(userId, playlistId) {
    const playlistRef = db.collection('users').doc(userId).collection('playlists').doc(playlistId);
    await playlistRef.delete();
    return { success: true };
}

/**
 * Récupère une playlist spécifique
 * @param {string} userId 
 * @param {string} playlistId 
 */
async function getPlaylist(userId, playlistId) {
    const playlistRef = db.collection('users').doc(userId).collection('playlists').doc(playlistId);
    const doc = await playlistRef.get();

    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() };
}

module.exports = {
    getUserPlaylists,
    createPlaylist,
    addToPlaylist,
    deletePlaylist,
    getPlaylist
};
