const { db } = require('../services/firebase');

const CODM_GRADES = [
    { name: "Recrue I", xp: 0 },
    { name: "Recrue II", xp: 50 },
    { name: "Soudat I", xp: 150 },
    { name: "Soudat II", xp: 300 },
    { name: "Élite I", xp: 600 },
    { name: "Élite II", xp: 1000 },
    { name: "Pro I", xp: 1500 },
    { name: "Pro II", xp: 2100 },
    { name: "Maître I", xp: 3000 },
    { name: "Maître II", xp: 4000 },
    { name: "Grand Maître I", xp: 5500 },
    { name: "Grand Maître II", xp: 7500 },
    { name: "Légendaire", xp: 10000 }
];

async function addXP(member, amount, source = 'message') {
    if (member.user.bot) return;

    const userRef = db.collection('users').doc(member.id);
    const userDoc = await userRef.get();

    let userData = userDoc.exists ? userDoc.data() : { xp: 0, level: CODM_GRADES[0].name };

    const oldXp = userData.xp || 0;
    const newXp = oldXp + amount;

    // Find new grade
    let newGrade = CODM_GRADES[0].name;
    for (const grade of CODM_GRADES) {
        if (newXp >= grade.xp) {
            newGrade = grade.name;
        } else {
            break;
        }
    }

    await userRef.set({
        username: member.user.username,
        xp: newXp,
        level: newGrade,
        lastActive: new Date(),
    }, { merge: true });

    // Log XP gain
    await db.collection('xp_logs').add({
        userId: member.id,
        amount,
        source,
        createdAt: new Date(),
    });

    // Check if grade changed to update roles
    if (newGrade !== userData.level) {
        await updateGradeRoles(member, newGrade);
    }
}

async function updateGradeRoles(member, newGradeName) {
    // This requires a mapping of Grade Name -> Role ID in the 'config' collection
    const configDoc = await db.collection('config').doc('grades').get();
    if (!configDoc.exists) return;

    const gradeRoles = configDoc.data();
    const roleId = gradeRoles[newGradeName];

    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
            // Remove old grade roles and add new one
            const allGradeRoleIds = Object.values(gradeRoles);
            await member.roles.remove(allGradeRoleIds).catch(() => { });
            await member.roles.add(role).catch(console.error);
        }
    }
}

module.exports = { addXP, CODM_GRADES };
