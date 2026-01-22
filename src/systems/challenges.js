const { db } = require('../services/firebase');

async function getActiveChallenges(guildId) {
    const snapshot = await db.collection('guilds').doc(guildId).collection('challenges').where('active', '==', true).get();
    const challenges = [];
    snapshot.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));
    return challenges;
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

module.exports = { getActiveChallenges, completeChallenge };
