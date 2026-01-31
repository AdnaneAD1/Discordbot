const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../services/firebase');
const crypto = require('crypto');

/**
 * Génère un nombre aléatoire cryptographiquement sécurisé dans un intervalle [0, max)
 * Utilise crypto.randomInt() pour garantir une distribution uniforme sans biais
 * @param {number} max - Borne supérieure exclusive
 * @returns {number} - Nombre aléatoire entre 0 et max-1
 */
function secureRandomInt(max) {
    return crypto.randomInt(0, max);
}

/**
 * Mélange un tableau de manière cryptographiquement sécurisée (Fisher-Yates avec crypto)
 * Chaque élément a exactement la même probabilité d'être à n'importe quelle position
 * @param {Array} array - Tableau à mélanger
 * @returns {Array} - Nouveau tableau mélangé
 */
function secureShuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Sélectionne des gagnants de manière équitable et cryptographiquement sécurisée
 * Algorithme: Fisher-Yates shuffle avec crypto.randomInt(), puis prendre les N premiers
 *
 * Garanties:
 * - Chaque participant a exactement la même probabilité (1/n) d'être sélectionné
 * - Utilise crypto.randomInt() qui est cryptographiquement sécurisé
 * - Pas de biais mathématique (contrairement à Math.random() % n)
 *
 * @param {Array} participants - Liste des IDs des participants
 * @param {number} count - Nombre de gagnants à sélectionner
 * @returns {Array} - Liste des IDs des gagnants
 */
function selectWinners(participants, count) {
    if (participants.length === 0) return [];
    if (count >= participants.length) return secureShuffleArray(participants);

    // Mélanger de manière sécurisée et prendre les N premiers
    const shuffled = secureShuffleArray(participants);
    return shuffled.slice(0, count);
}

async function startGiveaway(channel, prize, duration, winnerCount = 1, top10Only = false) {
    const client = channel.client;
    const endsAt = new Date(Date.now() + duration);

    const giveawayEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🎁 GIVEAWAY !')
        .setDescription(`**Prix**: ${prize}\n**Gagnants**: ${winnerCount}\n**Fin**: <t:${Math.floor(endsAt.getTime() / 1000)}:R>${top10Only ? '\n\n⚠️ **Participation réservée au TOP 10 du classement XP !**' : ''}`)
        .setFooter({ text: 'Cliquez sur le bouton pour participer !' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_entry')
                .setLabel('🎉 Participer')
                .setStyle(ButtonStyle.Danger),
        );

    const message = await channel.send({ content: '@everyone 🚀 **Nouveau Giveaway !**', embeds: [giveawayEmbed], components: [row] });

    await db.collection('giveaways').doc(message.id).set({
        messageId: message.id,
        guildId: channel.guild.id,
        channelId: channel.id,
        prize,
        endsAt,
        winnerCount,
        top10Only,
        participants: [],
        ended: false,
    });

    // Schedule end
    setTimeout(() => endGiveaway(client, message.id), duration);
}

async function endGiveaway(client, messageId) {
    const gRef = db.collection('giveaways').doc(messageId);
    const gDoc = await gRef.get();
    if (!gDoc.exists || gDoc.data().ended) return;

    const data = gDoc.data();
    const participants = data.participants;
    const channel = client.channels.cache.get(data.channelId);

    if (participants.length === 0) {
        await gRef.update({ ended: true });
        if (channel) {
            await channel.send(`🚫 **Giveaway Terminé** : Aucun participant.`);
        }
        return;
    }

    // Sélection équitable des gagnants avec crypto.randomInt()
    // Chaque participant a exactement 1/n chance de gagner
    const winnersIds = selectWinners(participants, data.winnerCount);

    console.log(`[Giveaway] Sélection de ${winnersIds.length} gagnant(s) parmi ${participants.length} participants`);

    await gRef.update({ ended: true, winners: winnersIds });

    if (channel) {
        // Remove buttons from original message
        try {
            const message = await channel.messages.fetch(messageId);
            if (message) {
                await message.edit({ components: [] }).catch(() => { });
            }
        } catch (err) {
            console.error(`Impossible de modifier le message du giveaway ${messageId}:`, err);
        }

        const winnersMention = winnersIds.map(id => `<@${id}>`).join(', ');
        await channel.send(`🎉 **Félicitations aux gagnants !**\n\nBravo à ${winnersMention} qui remporte(nt) : **${data.prize}** ! 🎁`);

        // Notify winners via DM
        for (const id of winnersIds) {
            try {
                const user = await client.users.fetch(id);
                if (user) {
                    await user.send(`🎁 **Félicitations !** Tu as gagné le giveaway pour : **${data.prize}** !\n\n⚠️ **Action requise** : Merci de contacter un administrateur en ouvrant un **Ticket** sur le serveur pour réclamer ton lot et connaître la marche à suivre.`);
                }
            } catch (err) {
                console.error(`Impossible d'envoyer un DM au gagnant ${id}:`, err);
            }
        }
    }
}

async function handleEntry(interaction) {
    const gRef = db.collection('giveaways').doc(interaction.message.id);
    const gDoc = await gRef.get();
    if (!gDoc.exists || gDoc.data().ended) return;

    const data = gDoc.data();
    const participants = data.participants;

    if (participants.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Vous participez déjà à ce giveaway !', flags: [64] });
    }

    if (data.top10Only) {
        // Fetch top 10 for this guild
        const topRef = db.collection('guilds').doc(interaction.guild.id).collection('users').orderBy('xp', 'desc').limit(10);
        const topSnap = await topRef.get();
        const topIds = topSnap.docs.map(doc => doc.id);

        if (!topIds.includes(interaction.user.id)) {
            return interaction.reply({
                content: '❌ Ce giveaway est réservé aux membres du **TOP 10** du classement XP. Travaillez votre rank pour participer ! 🏆',
                flags: [64]
            });
        }
    }

    participants.push(interaction.user.id);
    await gRef.update({ participants });

    await interaction.reply({ content: '✅ Participation enregistrée ! Bonne chance.', flags: [64] });
}

module.exports = { startGiveaway, handleEntry };
