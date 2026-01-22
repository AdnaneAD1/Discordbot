const { db } = require('../services/firebase');

const DEFAULT_CODM_GRADES = [
    { name: "Recrue", xp: 0, emoji: "🥉" },
    { name: "Vétéran", xp: 200, emoji: "🎖️" },
    { name: "Élite", xp: 600, emoji: "🏅" },
    { name: "Pro", xp: 1200, emoji: "🎖️" },
    { name: "Maître", xp: 2500, emoji: "🏆" },
    { name: "Grand Maître", xp: 5000, emoji: "🛡️" },
    { name: "Légendaire", xp: 10000, emoji: "👑" }
];

async function addXP(member, amount, source = 'message') {
    if (member.user.bot || !member.guild) return;

    const guildId = member.guild.id;
    const userRef = db.collection('guilds').doc(guildId).collection('users').doc(member.id);
    const userDoc = await userRef.get();

    // Fetch dynamic grades or use defaults
    const gradesDoc = await db.collection('guilds').doc(guildId).collection('config').doc('grades').get();
    const configGrades = gradesDoc.exists ? gradesDoc.data().paliers : null;
    const codmGrades = configGrades || DEFAULT_CODM_GRADES;

    let userData = userDoc.exists ? userDoc.data() : { xp: 0, level: codmGrades[0].name };

    const oldXp = userData.xp || 0;
    const newXp = oldXp + amount;

    // Find new grade based on current xp
    let newGrade = codmGrades[0].name;
    for (const grade of codmGrades) {
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

    // Log XP gain (guild isolated)
    await db.collection('guilds').doc(guildId).collection('xp_logs').add({
        userId: member.id,
        username: member.user.username,
        amount,
        source,
        createdAt: new Date(),
    });

    // Check if grade changed to update roles
    if (newGrade !== userData.level) {
        await updateGradeRoles(member, newGrade, codmGrades);

        // Notify in rank-up channel if configured
        const channelConfig = await db.collection('guilds').doc(guildId).collection('config').doc('channels').get();
        if (channelConfig.exists && channelConfig.data().rankUpChannelId) {
            const channel = member.guild.channels.cache.get(channelConfig.data().rankUpChannelId);
            if (channel) {
                const gradeObj = codmGrades.find(g => g.name === newGrade);
                const gradeEmoji = gradeObj?.emoji || '🎖️';
                await channel.send(`${gradeEmoji} Félicitations ${member} ! Tu viens de monter en grade : **${newGrade}** ! 🚀`);
            }
        }
    }
}

async function updateGradeRoles(member, newGradeName, codmGrades) {
    const guildId = member.guild.id;
    const configDoc = await db.collection('guilds').doc(guildId).collection('config').doc('roles').get();
    if (!configDoc.exists) return;

    const roleConfig = configDoc.data().gradeRoles || {};
    const roleId = roleConfig[newGradeName];

    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
            // Remove all other possibly assigned grade roles
            const allGradeRoleIds = Object.values(roleConfig);
            await member.roles.remove(allGradeRoleIds).catch(() => { });
            await member.roles.add(role).catch(console.error);
        }
    }
}

module.exports = { addXP, CODM_GRADES: DEFAULT_CODM_GRADES };
