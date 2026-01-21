const { db } = require('../services/firebase');

async function getActiveChallenges() {
    const snapshot = await db.collection('challenges').where('active', '==', true).get();
    const challenges = [];
    snapshot.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));
    return challenges;
}

async function completeChallenge(userId, challengeId) {
    const challengeRef = db.collection('challenges').doc(challengeId);
    const challenge = (await challengeRef.get()).data();

    if (!challenge || !challenge.active) return { success: false, message: 'Défi introuvable ou expiré.' };

    const userChallengeRef = db.collection('users').doc(userId).collection('completed_challenges').doc(challengeId);
    const completedDoc = await userChallengeRef.get();

    if (completedDoc.exists) return { success: false, message: 'Vous avez déjà terminé ce défi.' };

    // Mark as completed and give XP
    await userChallengeRef.set({ completedAt: new Date() });

    const { addXP } = require('./xp');
    // Note: Finding member object would be cleaner if passed in, but we can assume addXP handles it if we have the member
    // For now, return the reward amount to the caller
    return { success: true, rewardXp: challenge.rewardXp };
}

module.exports = { getActiveChallenges, completeChallenge };
