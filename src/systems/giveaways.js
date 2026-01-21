const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../services/firebase');

async function startGiveaway(channel, prize, duration, winnerCount = 1) {
    const endsAt = new Date(Date.now() + duration);

    const giveawayEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🎁 GIVEAWAY !')
        .setDescription(`**Prix**: ${prize}\n**Gagnants**: ${winnerCount}\n**Fin**: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
        .setFooter({ text: 'Cliquez sur le bouton pour participer !' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_entry')
                .setLabel('🎉 Participer')
                .setStyle(ButtonStyle.Danger),
        );

    const message = await channel.send({ embeds: [giveawayEmbed], components: [row] });

    await db.collection('giveaways').doc(message.id).set({
        messageId: message.id,
        channelId: channel.id,
        prize,
        endsAt,
        winnerCount,
        participants: [],
        ended: false,
    });

    // Schedule end (in a real production bot, you'd use a more robust scheduler)
    setTimeout(() => endGiveaway(message.id), duration);
}

async function endGiveaway(messageId) {
    const gRef = db.collection('giveaways').doc(messageId);
    const gDoc = await gRef.get();
    if (!gDoc.exists || gDoc.data().ended) return;

    const data = gDoc.data();
    const participants = data.participants;

    if (participants.length === 0) {
        // No participants
        await gRef.update({ ended: true });
        return;
    }

    // Pick winners
    const winners = [];
    for (let i = 0; i < Math.min(data.winnerCount, participants.length); i++) {
        const index = Math.floor(Math.random() * participants.length);
        winners.push(participants.splice(index, 1)[0]);
    }

    await gRef.update({ ended: true, winners });

    // Update message and notify
    // Note: We need client object here or use a webhook. For simplicity, we just log to DB.
    // The actual bot should mention winners in the channel.
}

async function handleEntry(interaction) {
    const gRef = db.collection('giveaways').doc(interaction.message.id);
    const gDoc = await gRef.get();
    if (!gDoc.exists || gDoc.data().ended) return;

    const participants = gDoc.data().participants;
    if (participants.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Vous participez déjà à ce giveaway !', ephemeral: true });
    }

    participants.push(interaction.user.id);
    await gRef.update({ participants });

    await interaction.reply({ content: '✅ Participation enregistrée ! Bonne chance.', ephemeral: true });
}

module.exports = { startGiveaway, handleEntry };
