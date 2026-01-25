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
