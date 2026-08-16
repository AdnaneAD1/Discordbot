const { db } = require('../services/firebase');

// Caches
const gradesCache = new Map(); // guildId -> grades
const xpCooldowns = new Map(); // userId -> lastTimestamp
const COOLDOWN_TIME = 60 * 1000; // 1 minute

// Buffer in-memory
const xpBuffer = new Map(); // "guildId-userId" -> { member, amount, sources }

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

    // Check cooldown for message XP
    if (source === 'message') {
        const lastTimestamp = xpCooldowns.get(member.id);
        const now = Date.now();
        if (lastTimestamp && (now - lastTimestamp) < COOLDOWN_TIME) {
            return;
        }
        xpCooldowns.set(member.id, now);
    }

    // Add to buffer
    const key = `${member.guild.id}-${member.id}`;
    let buffered = xpBuffer.get(key);
    if (!buffered) {
        buffered = {
            member,
            amount: 0,
            sources: {}
        };
        xpBuffer.set(key, buffered);
    }
    buffered.amount += amount;
    buffered.sources[source] = (buffered.sources[source] || 0) + amount;
}

function getBufferedXP(guildId, userId) {
    const key = `${guildId}-${userId}`;
    const buffered = xpBuffer.get(key);
    return buffered ? buffered.amount : 0;
}

async function flushXPBuffer() {
    if (xpBuffer.size === 0) return;

    const entries = Array.from(xpBuffer.entries());
    xpBuffer.clear();

    console.log(`[XP Buffering] Flushing ${entries.length} buffered XP updates...`);

    const docRefs = entries.map(([key]) => {
        const [guildId, userId] = key.split('-');
        return db.collection('guilds').doc(guildId).collection('users').doc(userId);
    });

    try {
        const docs = docRefs.length > 0 ? await db.getAll(...docRefs) : [];
        const batch = db.batch();

        for (let i = 0; i < entries.length; i++) {
            const [key, bufferedData] = entries[i];
            const [guildId, userId] = key.split('-');
            const userDoc = docs[i];
            const member = bufferedData.member;

            let codmGrades = gradesCache.get(guildId);
            if (!codmGrades) {
                const gradesDoc = await db.collection('guilds').doc(guildId).collection('config').doc('grades').get();
                codmGrades = gradesDoc.exists ? gradesDoc.data().paliers : DEFAULT_CODM_GRADES;
                gradesCache.set(guildId, codmGrades);
                setTimeout(() => gradesCache.delete(guildId), 5 * 60 * 1000);
            }

            let userData = userDoc && userDoc.exists ? userDoc.data() : { xp: 0, level: codmGrades[0].name };
            const oldXp = userData.xp || 0;
            const newXp = oldXp + bufferedData.amount;

            let newGrade = codmGrades[0].name;
            for (const grade of codmGrades) {
                if (newXp >= grade.xp) {
                    newGrade = grade.name;
                } else {
                    break;
                }
            }

            const userRef = db.collection('guilds').doc(guildId).collection('users').doc(userId);
            batch.set(userRef, {
                username: member.user.username,
                xp: newXp,
                level: newGrade,
                lastActive: new Date(),
            }, { merge: true });

            for (const [source, amount] of Object.entries(bufferedData.sources)) {
                const logRef = db.collection('guilds').doc(guildId).collection('xp_logs').doc();
                batch.set(logRef, {
                    userId: member.id,
                    username: member.user.username,
                    amount,
                    source,
                    createdAt: new Date(),
                });
            }

            if (newGrade !== userData.level) {
                updateGradeRoles(member, newGrade, codmGrades).catch(console.error);

                db.collection('guilds').doc(guildId).collection('config').doc('channels').get().then(channelConfig => {
                    if (channelConfig.exists && channelConfig.data().rankUpChannelId) {
                        const channel = member.guild.channels.cache.get(channelConfig.data().rankUpChannelId);
                        if (channel) {
                            const gradeObj = codmGrades.find(g => g.name === newGrade);
                            const gradeEmoji = gradeObj?.emoji || '🎖️';
                            channel.send(`${gradeEmoji} Félicitations ${member} ! Tu viens de monter en grade : **${newGrade}** ! 🚀`).catch(() => {});
                        }
                    }
                }).catch(console.error);
            }
        }

        await batch.commit();
        console.log(`[XP Buffering] Batch commit complete for ${entries.length} users.`);
    } catch (err) {
        console.error("[XP Buffering] Error during flush:", err);
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
            const allGradeRoleIds = Object.values(roleConfig);
            await member.roles.remove(allGradeRoleIds).catch(() => { });
            await member.roles.add(role).catch(console.error);
        }
    }
}

// Flush periodically every 30 seconds
setInterval(() => {
    flushXPBuffer().catch(console.error);
}, 30 * 1000);

// Auto-flush on process exit
process.on('SIGINT', async () => {
    console.log('[XP Buffering] SIGINT received. Flushing buffer before exit...');
    await flushXPBuffer().catch(console.error);
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[XP Buffering] SIGTERM received. Flushing buffer before exit...');
    await flushXPBuffer().catch(console.error);
    process.exit(0);
});

module.exports = { addXP, getBufferedXP, flushXPBuffer, CODM_GRADES: DEFAULT_CODM_GRADES };
