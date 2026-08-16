const configCache = require('../services/configCache');
const { db } = require('../services/firebase');

function normalizeText(text) {
    let normalized = text.toLowerCase();
    
    // Table de traduction Leetspeak
    const leetMap = {
        '4': 'a', '@': 'a',
        '3': 'e',
        '1': 'i', '!': 'i', '|': 'i',
        '0': 'o',
        '5': 's', '$': 's',
        '7': 't',
        '8': 'b',
        '9': 'g'
    };
    
    for (const [leet, normal] of Object.entries(leetMap)) {
        normalized = normalized.replaceAll(leet, normal);
    }
    
    // Supprimer tous les caractères non-alphanumériques (y compris les espaces)
    normalized = normalized.replace(/[^a-z0-9]/gi, '');
    
    return normalized;
}

async function addWarning(member, reason, moderatorId, channelToNotify = null) {
    const guildId = member.guild.id;
    const userId = member.user.id;

    // Sauvegarde en base de données (isolé par guilde)
    const warnRef = db.collection('guilds').doc(guildId).collection('users').doc(userId).collection('warnings');
    await warnRef.add({
        moderatorId,
        reason: reason,
        createdAt: new Date(),
    });

    // Récupérer le nombre total d'avertissements
    const snapshot = await warnRef.get();
    const warnCount = snapshot.size;

    // Notifier l'utilisateur par DM
    try {
        await member.send(`⚠️ **Avertissement reçu** sur le serveur **${member.guild.name}**\n**Raison :** ${reason}\n**Total d'avertissements :** ${warnCount}`);
    } catch (e) {
        console.log(`Could not send DM to user ${userId}`);
    }

    // Seuils de sanctions automatiques
    let sanctionMessage = null;

    if (warnCount >= 5) {
        // Exclusion ou Bannissement automatique
        if (member.bannable) {
            await member.ban({ reason: `Auto-modération : ${warnCount} avertissements cumulés.` });
            sanctionMessage = `🚨 **${member.user.tag}** a été banni définitivement après avoir accumulé **${warnCount}** avertissements.`;
        } else if (member.kickable) {
            await member.kick(`Auto-modération : ${warnCount} avertissements cumulés.`);
            sanctionMessage = `🚨 **${member.user.tag}** a été exclu après avoir accumulé **${warnCount}** avertissements.`;
        }
    } else if (warnCount >= 3) {
        // Sourdine temporaire (Timeout) de 1 heure
        const timeoutDuration = 60 * 60 * 1000; // 1 heure
        if (member.moderatable) {
            await member.timeout(timeoutDuration, `Auto-modération : ${warnCount} avertissements cumulés.`);
            sanctionMessage = `🤐 **${member.user.tag}** a été mis en sourdine (Timeout) pendant 1 heure après avoir accumulé **${warnCount}** avertissements.`;
        }
    }

    // Envoi de la notification de sanction sur le salon textuel
    if (channelToNotify && sanctionMessage) {
        await channelToNotify.send(sanctionMessage).catch(() => {});
    }

    return { warnCount, sanctionMessage };
}

async function checkMessage(message) {
    if (message.author.bot || !message.guild) return false;

    const guildId = message.guild.id;
    // Récupérer la configuration de modération via le cache
    const modConfig = await configCache.getConfig(guildId, 'moderation') || {
        forbiddenWords: [],
        antiLinks: true,
        antiSpam: true
    };

    const content = message.content.toLowerCase();
    const normalizedContent = normalizeText(message.content);

    // 1. Mots Interdits (avec normalisation leetspeak)
    for (const word of modConfig.forbiddenWords) {
        const cleanWord = word.toLowerCase();
        const cleanNormalizedWord = normalizeText(word);
        
        if (content.includes(cleanWord) || normalizedContent.includes(cleanNormalizedWord)) {
            // Supprimer le message
            await message.delete().catch(() => {});
            
            await message.channel.send(`⚠️ ${message.author}, votre message a été supprimé car il contient un mot interdit.`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });

            // Avertir l'utilisateur
            const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
            if (member) {
                await addWarning(member, `Mot interdit : ${word}`, message.client.user.id, message.channel);
            }
            return true;
        }
    }

    // 2. Anti-Liens
    if (modConfig.antiLinks && (content.includes('http://') || content.includes('https://') || content.includes('discord.gg/'))) {
        const isGif = content.includes('tenor.com') || content.includes('giphy.com');

        if (!isGif && !message.member.permissions.has('ManageMessages')) {
            await message.reply({
                content: '⚠️ **Attention :** Ce message contient un lien externe non vérifié. Restez vigilants !',
                allowedMentions: { repliedUser: false }
            }).then(msg => {
                setTimeout(() => msg.delete().catch(() => { }), 10000);
            });

            return true;
        }
    }

    return false;
}

module.exports = { checkMessage, addWarning };
