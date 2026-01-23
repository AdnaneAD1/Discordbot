const { Events, ChannelType, EmbedBuilder } = require('discord.js');

const formatTime = (ms) => {
    if (isNaN(ms) || ms <= 0) return '00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts = [];
    if (hours > 0) parts.push(hours);
    parts.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
    parts.push(seconds < 10 ? `0${seconds}` : seconds);

    return parts.join(':');
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            // --- Music Channel Restriction ---
            const musicCommands = ['play', 'pause', 'skip', 'stop', 'back', 'loop', 'queue', 'nowplaying'];
            if (musicCommands.includes(interaction.commandName)) {
                const { db } = require('../services/firebase');
                const channelConfig = await db.collection('guilds').doc(interaction.guild.id).collection('config').doc('channels').get();
                if (channelConfig.exists) {
                    const musicTextChannelId = channelConfig.data().musicTextChannelId;
                    const isVoiceChat = interaction.channel.type === ChannelType.GuildVoice;

                    if (musicTextChannelId && interaction.channelId !== musicTextChannelId && !isVoiceChat) {
                        return interaction.reply({
                            content: `❌ Les commandes de musique doivent être utilisées dans le salon <#${musicTextChannelId}> ou dans le chat de ton salon vocal.`,
                            flags: [64]
                        });
                    }
                }
            }
            // ---------------------------------

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Command Execution Error:', error);

                // Check if interaction is still valid (less than 15 mins but usually 3s for initial reply)
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
                    } else {
                        await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
                    }
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError.message);
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_')) {
                const type = interaction.customId.split('_')[1];
                const { createTicket } = require('../systems/tickets');
                const channel = await createTicket(interaction, type);
                await interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, flags: [64] });
            } else if (interaction.customId === 'close_ticket') {
                const { closeTicket } = require('../systems/tickets');
                await closeTicket(interaction.channel, interaction.user);
            } else if (interaction.customId === 'giveaway_entry') {
                const { handleEntry } = require('../systems/giveaways');
                await handleEntry(interaction);
            } else if (interaction.customId.startsWith('music_')) {
                const { kazagumo } = interaction.client;
                const player = kazagumo.players.get(interaction.guild.id);

                if (!player) return interaction.reply({ content: '❌ Plus de musique en cours.', flags: [64] });

                const action = interaction.customId.replace('music_', '');

                switch (action) {
                    case 'back':
                        if (!player.queue.previous) return interaction.reply({ content: '❌ Pas de morceau précédent.', flags: [64] });
                        player.queue.unshift(player.queue.previous);
                        player.skip();
                        await interaction.reply({ content: '⏪ Retour au morceau précédent !' });
                        break;
                    case 'loop':
                        // Kazagumo loop modes: 'none', 'track', 'queue'
                        let newLoop = 'none';
                        if (player.loop === 'none') newLoop = 'track';
                        else if (player.loop === 'track') newLoop = 'queue';

                        player.setLoop(newLoop);
                        const loopMessages = { 'none': 'désactivée', 'track': 'du morceau actuel', 'queue': 'de la file d\'attente' };
                        await interaction.reply({ content: `🔁 Répétition **${loopMessages[newLoop]}** !` });
                        break;
                    case 'pause':
                        player.pause(!player.paused);
                        await interaction.reply({ content: player.paused ? '⏸️ Musique en pause' : '▶️ Musique reprise' });
                        break;
                    case 'stop':
                        player.destroy();
                        await interaction.reply({ content: '⏹️ Musique arrêtée et file nettoyée.' });
                        break;
                    case 'skip':
                        player.skip();
                        await interaction.reply({ content: '⏭️ Morceau suivant !' });
                        break;
                    case 'queue':
                        const queue = player.queue;
                        const currentTrack = player.queue.current;

                        const qEmbed = new EmbedBuilder()
                            .setColor('#febc11')
                            .setTitle(`🎶 File d'attente - ${interaction.guild.name}`)
                            .setThumbnail(currentTrack?.thumbnail || null);

                        let qDescription = `**En cours :**\n[${currentTrack.title}](${currentTrack.uri}) - \`${formatTime(currentTrack.length)}\`\n\n`;

                        if (queue.length === 0) {
                            qDescription += "*La file d'attente est vide.*";
                        } else {
                            qDescription += "**À venir :**\n";
                            const tracks = queue.slice(0, 10).map((track, index) => {
                                return `**${index + 1}.** [${track.title}](${track.uri}) - \`${formatTime(track.length)}\``;
                            });

                            qDescription += tracks.join('\n');

                            if (queue.length > 10) {
                                qDescription += `\n\n*...et ${queue.length - 10} autres morceaux.*`;
                            }
                        }

                        const totalDuration = (currentTrack ? (currentTrack.length || 0) : 0) + (queue.duration || 0);
                        qDescription += `\n\n**Total :** \`${queue.length + 1}\` morceau(x) | **Durée totale :** \`${formatTime(totalDuration)}\``;

                        qEmbed.setDescription(qDescription);

                        await interaction.reply({ embeds: [qEmbed] });
                        break;
                }
            }
        }
    }
};
