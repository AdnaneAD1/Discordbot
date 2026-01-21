const { db } = require('../services/firebase');

async function acceptRules(member) {
    try {
        const userRef = db.collection('users').doc(member.id);
        const regRef = db.collection('regulations').doc(member.id);

        const now = new Date();

        // Update User in DB
        await userRef.set({
            username: member.user.username,
            acceptedRules: true,
            lastActive: now,
        }, { merge: true });

        // Update Regulation log
        await regRef.set({
            accepted: true,
            acceptedAt: now,
        }, { merge: true });

        // Manage Roles
        // Note: IDs should be configurable via DB/Dashboard. For now, we'll need to fetch them.
        const configRef = db.collection('config').doc('roles');
        const config = (await configRef.get()).data();

        if (config) {
            if (config.unverifiedRoleId) {
                await member.roles.remove(config.unverifiedRoleId).catch(console.error);
            }
            if (config.memberRoleId) {
                await member.roles.add(config.memberRoleId).catch(console.error);
            }
        }

        return true;
    } catch (error) {
        console.error('Error in acceptRules:', error);
        return false;
    }
}

module.exports = { acceptRules };
