const { db } = require('../services/firebase');

async function checkMessage(message) {
    if (message.author.bot || !message.guild) return false;

    const guildId = message.guild.id;
    // Fetch moderation config (guild specific)
    const modConfigRef = db.collection('guilds').doc(guildId).collection('config').doc('moderation');
    const modConfig = (await modConfigRef.get()).data() || {
        forbiddenWords: [],
        antiLinks: true,
        antiSpam: true
    };

    const content = message.content.toLowerCase();

    // 1. Forbidden Words
    for (const word of modConfig.forbiddenWords) {
        if (content.includes(word.toLowerCase())) {
            await moderate(message, 'Forbidden Word');
            return true;
        }
    }

    // 2. Anti-Links
    if (modConfig.antiLinks && (content.includes('http://') || content.includes('https://') || content.includes('discord.gg/'))) {
        if (!message.member.permissions.has('ManageMessages')) {
            await moderate(message, 'Unauthorised Link');
            return true;
        }
    }

    return false;
}

async function moderate(message, reason) {
    const guildId = message.guild.id;
    try {
        await message.delete();
        await message.channel.send(`${message.author}, votre message a été supprimé pour la raison suivante : **${reason}**.`).then(msg => {
            setTimeout(() => msg.delete(), 5000);
        });

        // Log to DB (guild isolated)
        await db.collection('guilds').doc(guildId).collection('mod_logs').add({
            userId: message.author.id,
            username: message.author.username,
            action: 'DELETE',
            reason: reason,
            createdAt: new Date(),
        });
    } catch (error) {
        console.error('Error in moderate function:', error);
    }
}

module.exports = { checkMessage };
