const { db } = require('../services/firebase');

async function getActiveChallenges(guildId) {
    const snapshot = await db.collection('guilds').doc(guildId).collection('challenges').where('active', '==', true).get();
    const challenges = [];
    const now = new Date();

    // Check each challenge for expiration
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        // If expired, mark as inactive
        if (expiresAt < now) {
            await doc.ref.update({ active: false });
            console.log(`Challenge "${data.title}" expired and marked inactive.`);
        } else {
            // Still active, add to list
            challenges.push({ id: doc.id, ...data });
        }
    }

    return challenges;
}

async function completeChallenge(member, challengeId) {
    const guildId = member.guild.id;
    const challengeRef = db.collection('guilds').doc(guildId).collection('challenges').doc(challengeId);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
        return { success: false, message: 'Défi introuvable.' };
    }

    const challenge = challengeDoc.data();

    // Check if expired
    const expiresAt = challenge.expiresAt?.toDate ? challenge.expiresAt.toDate() : new Date(challenge.expiresAt);
    if (expiresAt < new Date()) {
        await challengeRef.update({ active: false });
        return { success: false, message: 'Ce défi a expiré.' };
    }

    if (!challenge.active) {
        return { success: false, message: 'Défi introuvable ou expiré.' };
    }

    const userChallengeRef = db.collection('guilds').doc(guildId).collection('users').doc(member.id).collection('completed_challenges').doc(challengeId);
    const completedDoc = await userChallengeRef.get();

    if (completedDoc.exists) {
        return { success: false, message: 'Vous avez déjà terminé ce défi.' };
    }

    await userChallengeRef.set({ completedAt: new Date() });

    const { addXP } = require('./xp');
    await addXP(member, challenge.rewardXp, 'challenge');

    return { success: true, rewardXp: challenge.rewardXp };
}

module.exports = { getActiveChallenges, completeChallenge };
