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
    console.log(`[SYSTEM] Lancement du nettoyage des défis expirés (V2 - CollectionGroup)...`);

    try {
        // Recherche de tous les défis expirés dans TOUTES les sous-collections 'challenges' des guildes
        const expiredSnapshot = await db.collectionGroup('challenges')
            .where('active', '==', true)
            .where('expiresAt', '<=', now)
            .get();

        if (expiredSnapshot.empty) {
            console.log(`[SYSTEM] Aucun défi expiré trouvé.`);
            return;
        }

        console.log(`[SYSTEM] ${expiredSnapshot.size} défi(s) expiré(s) détecté(s). Désactivation...`);

        const batch = db.batch();
        expiredSnapshot.forEach(doc => {
            batch.update(doc.ref, { active: false });
            // doc.ref.parent.parent est la référence de la guilde (doc guilds/GUILD_ID)
            const guildId = doc.ref.parent.parent.id;
            console.log(`[INFO] Défi expiré désactivé : ${doc.data().title} (${doc.id}) sur le serveur ${guildId}`);
        });

        await batch.commit();
        console.log(`[SYSTEM] Nettoyage terminé avec succès.`);
    } catch (error) {
        console.error(`[ERROR] Erreur lors du nettoyage des défis :`, error);
        if (error.code === 'failed-precondition') {
            console.warn('[WARNING] L\'index CollectionGroup pour "challenges" n\'est probablement pas encore créé dans Firebase. Utilisation du fallback...');
        }
    }
}

async function completeChallenge(member, challengeId) {
    const guildId = member.guild.id;
    const challengeRef = db.collection('guilds').doc(guildId).collection('challenges').doc(challengeId);
    const challenge = (await challengeRef.get()).data();

    if (!challenge || !challenge.active) return { success: false, message: 'Défi introuvable ou expiré.' };

    const userChallengeRef = db.collection('guilds').doc(guildId).collection('users').doc(member.id).collection('completed_challenges').doc(challengeId);
    const completedDoc = await userChallengeRef.get();

    if (completedDoc.exists) return { success: false, message: 'Vous avez déjà terminé ce défi.' };

    await userChallengeRef.set({ completedAt: new Date() });

    const { addXP } = require('./xp');
    await addXP(member, challenge.rewardXp, 'challenge');

    return { success: true, rewardXp: challenge.rewardXp };
}

module.exports = { getActiveChallenges, completeChallenge, cleanupExpiredChallenges };
