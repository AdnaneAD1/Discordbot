const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../services/firebase');

async function createTicket(interaction, type) {
    const { guild, user } = interaction;

    // Check config (Guild-specific)
    const configDoc = await db.collection('guilds').doc(guild.id).collection('config').doc('tickets').get();
    const config = configDoc.data() || {};
    const categoryId = config.categoryId;
    const staffRoleId = config.staffRoleId;

    const permissionOverwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        }
    ];

    if (staffRoleId) {
        permissionOverwrites.push({
            id: staffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        });
    }

    const channel = await guild.channels.create({
        name: `ticket-${type}-${user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: permissionOverwrites,
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
    const guild = channel.guild;

    // Fetch config for tickets (Guild-specific)
    const configDoc = await db.collection('guilds').doc(guild.id).collection('config').doc('tickets').get();
    const config = configDoc.data() || {};
    const logChannelId = config.logChannelId;

    // Fetch messages to generate transcript
    let messages = [];
    try {
        const fetched = await channel.messages.fetch({ limit: 100 });
        messages = Array.from(fetched.values()).reverse();
    } catch (e) {
        console.error('Error fetching messages for ticket transcript:', e);
    }

    // Helper to escape HTML tags
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Generate HTML content
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <title>Transcript - ${channel.name}</title>
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #36393f; color: #dcddde; padding: 20px; }
            .header { border-bottom: 1px solid #4f545c; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #fff; margin: 0; font-size: 24px; }
            .header p { margin: 5px 0 0 0; color: #b9bbbe; font-size: 14px; }
            .message-container { display: flex; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 10px; }
            .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; background-color: #4f545c; }
            .message-content { display: flex; flex-direction: column; }
            .author-name { font-weight: bold; color: #fff; margin-right: 10px; font-size: 15px; }
            .timestamp { font-size: 12px; color: #72767d; }
            .text { margin-top: 5px; word-break: break-word; line-height: 1.4; font-size: 14px; white-space: pre-wrap; }
            .attachment { margin-top: 5px; }
            .attachment img { max-width: 400px; border-radius: 4px; border: 1px solid #202225; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Transcript - ${channel.name}</h1>
            <p>Fermé par : <strong>${moderator.tag}</strong> (ID: ${moderator.id}) le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
    `;

    for (const msg of messages) {
        if (msg.author.bot && msg.embeds.length > 0 && msg.embeds[0].title?.includes('Ticket')) {
            continue; // Skip the welcome embed to keep log clean
        }

        const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
        const attachmentsHtml = msg.attachments.map(a => {
            if (a.contentType?.startsWith('image/')) {
                return `<div class="attachment"><a href="${a.url}" target="_blank"><img src="${a.url}" alt="Attachment"></a></div>`;
            } else {
                return `<div class="attachment"><a href="${a.url}" style="color: #00aff4; text-decoration: none;" target="_blank">📎 ${a.name}</a></div>`;
            }
        }).join('');

        htmlContent += `
        <div class="message-container">
            <img class="avatar" src="${avatarUrl}" alt="Avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <div class="message-content">
                <div>
                    <span class="author-name">${msg.author.username}</span>
                    <span class="timestamp">${msg.createdAt.toLocaleString('fr-FR')}</span>
                </div>
                <div class="text">${escapeHtml(msg.content)}</div>
                ${attachmentsHtml}
            </div>
        </div>
        `;
    }

    htmlContent += `
    </body>
    </html>
    `;

    const buffer = Buffer.from(htmlContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });

    // Send log to log channel
    let logChannel = null;
    if (logChannelId) {
        logChannel = guild.channels.cache.get(logChannelId);
    }
    if (!logChannel) {
        // Fallback lookup
        logChannel = guild.channels.cache.find(c => c.name === 'ticket-logs' || c.name === 'logs' || c.name === 'log-ticket');
    }

    const logEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fermé')
        .setDescription(`Le ticket **${channel.name}** a été fermé par **${moderator.username}**.`)
        .addFields(
            { name: 'Modérateur', value: `<@${moderator.id}> (${moderator.tag})`, inline: true },
            { name: 'Salon', value: `\`${channel.name}\``, inline: true },
            { name: 'Messages', value: `\`${messages.length}\``, inline: true }
        )
        .setColor('#e74c3c')
        .setTimestamp();

    if (logChannel) {
        try {
            await logChannel.send({ embeds: [logEmbed], files: [attachment] });
        } catch (err) {
            console.error('Failed to send transcript to log channel:', err);
        }
    }

    // DM moderator
    try {
        await moderator.send({
            content: `📄 Voici le transcript du ticket **${channel.name}** fermé sur **${guild.name}**.`,
            files: [attachment]
        });
    } catch (e) {
        console.log('Could not DM moderator transcript');
    }

    // DM ticket creator
    const ticketDocSnapshot = await db.collection('guilds').doc(guild.id).collection('tickets').where('channelId', '==', channel.id).get();
    if (!ticketDocSnapshot.empty) {
        const ticketData = ticketDocSnapshot.docs[0].data();
        const creatorId = ticketData.userId;
        if (creatorId && creatorId !== moderator.id) {
            try {
                const creator = await guild.members.fetch(creatorId).catch(() => null);
                if (creator) {
                    await creator.send({
                        content: `📄 Votre ticket **${channel.name}** sur **${guild.name}** a été fermé. Voici l'historique complet de votre demande.`,
                        files: [attachment]
                    });
                }
            } catch (e) {
                console.log('Could not DM creator transcript');
            }
        }
    }

    // Update status in DB (Guild-specific)
    ticketDocSnapshot.forEach(async (doc) => {
        await doc.ref.update({
            status: 'closed',
            closedAt: new Date(),
            closedBy: moderator.id,
        });
    });

    await channel.send('Ce ticket sera fermé dans 5 secondes...');
    setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports = { createTicket, closeTicket };
