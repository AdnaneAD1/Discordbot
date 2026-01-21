const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { db } = require('../services/firebase');

async function createTicket(interaction, type) {
    const { guild, user } = interaction;

    // Check config (Guild-specific)
    const configDoc = await db.collection('guilds').doc(guild.id).collection('config').doc('tickets').get();
    const config = configDoc.data() || {};
    const categoryId = config.categoryId;
    const staffRoleId = config.staffRoleId;

    const channel = await guild.channels.create({
        name: `ticket-${type}-${user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
            {
                id: staffRoleId || guild.roles.everyone.id, // Fallback to everyone if no staff role
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
        ],
    });

    // Save to DB (Guild-specific)
    await db.collection('guilds').doc(guild.id).collection('tickets').add({
        userId: user.id,
        channelId: channel.id,
        type: type,
        status: 'open',
        createdAt: new Date(),
    });

    const ticketEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`Ticket ${type.toUpperCase()}`)
        .setDescription(`Bonjour ${user}, un membre de l'équipe va vous répondre prochainement.\n\nMerci de détailler votre demande.`)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Fermer le ticket')
                .setStyle(ButtonStyle.Danger),
        );

    await channel.send({ content: `${user} ${staffRoleId ? `<@&${staffRoleId}>` : ''}`, embeds: [ticketEmbed], components: [row] });

    return channel;
}

async function closeTicket(channel, moderator) {
    // Update status in DB (Guild-specific)
    const snapshot = await db.collection('guilds').doc(channel.guild.id).collection('tickets').where('channelId', '==', channel.id).get();
    snapshot.forEach(async (doc) => {
        await doc.ref.update({
            status: 'closed',
            closedAt: new Date(),
            closedBy: moderator.id,
        });
    });

    await channel.send('Ce ticket sera fermé dans 5 secondes...');
    setTimeout(() => channel.delete(), 5000);
}


module.exports = { createTicket, closeTicket };
