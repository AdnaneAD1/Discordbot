const { db } = require('../services/firebase');

async function getActiveChallenges(guildId) {
    const now = new Date();
    const snapshot = await db.collection('guilds').doc(guildId).collection('challenges')
        .where('active', '==', true)
        .where('expiresAt', '>', now)
        .get();

    const challenges = [];
    snapshot.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));
    return challenges;
}

async function cleanupExpiredChallenges(client) {
    const now = new Date();
    console.log(`[SYSTEM] Lancement du nettoyage des défis expirés...`);

    try {
        const guildsSnapshot = await db.collection('guilds').get();

        for (const guildDoc of guildsSnapshot.docs) {
            const challengesRef = db.collection('guilds').doc(guildDoc.id).collection('challenges');
            const expiredSnapshot = await challengesRef
                .where('active', '==', true)
                .where('expiresAt', '<=', now)
                .get();

            if (expiredSnapshot.empty) continue;

            const batch = db.batch();
            expiredSnapshot.forEach(doc => {
                batch.update(doc.ref, { active: false });
                console.log(`[INFO] Défi expiré désactivé : ${doc.data().title} (${doc.id}) sur le serveur ${guildDoc.id}`);
            });

            await batch.commit();
        }
    } catch (error) {
        console.error(`[ERROR] Erreur lors du nettoyage des défis :`, error);
    }
}

module.exports = { getActiveChallenges, completeChallenge, cleanupExpiredChallenges };
