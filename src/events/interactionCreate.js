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
            const { customId } = interaction;
            if (customId.startsWith('ticket_')) {
                const type = customId.split('_')[1];
                const { createTicket } = require('../systems/tickets');
                const channel = await createTicket(interaction, type);
                await interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, flags: [64] });
            } else if (customId === 'close_ticket') {
                const { closeTicket } = require('../systems/tickets');
                await closeTicket(interaction.channel, interaction.user);
            } else if (customId === 'giveaway_entry') {
                const { handleEntry } = require('../systems/giveaways');
                await handleEntry(interaction);
            } else if (customId.startsWith('music_')) {
                const { kazagumo } = interaction.client;
                const player = kazagumo.players.get(interaction.guild.id);

                if (!player) return interaction.reply({ content: '❌ Plus de musique en cours.', flags: [64] });

                const action = customId.replace('music_', '');

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

                        const totalDuration = (currentTrack ? (currentTrack.length || 0) : 0) + queue.reduce((acc, track) => acc + (track.length || 0), 0);
                        qDescription += `\n\n**Total :** \`${queue.length + 1}\` morceau(x) | **Durée totale :** \`${formatTime(totalDuration)}\``;

                        qEmbed.setDescription(qDescription);

                        await interaction.reply({ embeds: [qEmbed] });
                        break;

                    case 'voteskip':
                        const { handleVoteSkip } = require('../services/music');
                        const voiceChannel = interaction.member.voice.channel;

                        if (!voiceChannel) {
                            return interaction.reply({ content: '❌ Tu dois être dans un salon vocal.', flags: [64] });
                        }

                        const voteResult = handleVoteSkip(player, interaction.user.id, voiceChannel);

                        if (!voteResult.success) {
                            return interaction.reply({ content: `❌ ${voteResult.error}`, flags: [64] });
                        }

                        if (voteResult.skipped) {
                            await interaction.reply({ content: `🗳️ **Vote Skip réussi !** (${voteResult.current}/${voteResult.required}) - Morceau suivant !` });
                        } else {
                            await interaction.reply({ content: `🗳️ Vote enregistré ! (${voteResult.current}/${voteResult.required} votes nécessaires)` });
                        }
                        break;

                    case 'shuffle':
                        if (player.queue.length < 2) {
                            return interaction.reply({ content: '❌ Pas assez de morceaux dans la file pour mélanger.', flags: [64] });
                        }

                        // Mélanger la queue (Fisher-Yates shuffle)
                        const queueArray = [...player.queue];
                        for (let i = queueArray.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [queueArray[i], queueArray[j]] = [queueArray[j], queueArray[i]];
                        }

                        player.queue.clear();
                        for (const track of queueArray) {
                            player.queue.add(track);
                        }

                        await interaction.reply({ content: `🔀 File d'attente mélangée ! (${queueArray.length} morceaux)` });
                        break;
                }
            } else if (customId.startsWith('lg_')) {
                // Gestion des boutons Loup-Garou
                const manager = interaction.client.werewolf;

                // Recherche robuste de la partie
                let game = null;
                const channel = interaction.channel || interaction.message?.channel;

                // 1. Essai via le mapping joueur
                game = manager.getGameByPlayerId(interaction.user.id);

                // 2. Fallback via le salon/thread
                if (!game && channel) {
                    if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
                        game = manager.getGame(channel.parentId);
                    } else {
                        game = manager.getGame(channel.id);
                    }
                }

                if (!game) {
                    return interaction.reply({ content: "❌ Cette partie n'existe plus.", flags: [64] });
                }

                if (customId === 'lg_join') {
                    if (game.addPlayer(interaction.user)) {
                        await game.updateLobby();
                        await interaction.reply({ content: "✅ Tu as rejoint la partie !", flags: [64] });
                    } else {
                        await interaction.reply({ content: "⚠️ Tu es déjà dans la partie.", flags: [64] });
                    }
                } else if (customId === 'lg_leave') {
                    if (game.removePlayer(interaction.user.id)) {
                        await game.updateLobby();
                        await interaction.reply({ content: "👋 Tu as quitté la partie.", flags: [64] });
                    } else {
                        await interaction.reply({ content: "⚠️ Tu n'es pas dans la partie.", flags: [64] });
                    }
                } else if (customId === 'lg_start') {
                    if (interaction.user.id !== game.host.id) {
                        return interaction.reply({ content: "❌ Seul l'hôte peut lancer la partie.", flags: [64] });
                    }
                    await interaction.deferUpdate(); // On valide l'appui
                    await game.start();
                } else if (customId === 'lg_stop') {
                    if (interaction.user.id !== game.host.id && !interaction.member.permissions.has('Administrator')) {
                        return interaction.reply({ content: "❌ Seul l'hôte ou un admin peut arrêter la partie.", flags: [64] });
                    }
                    game.stop();
                    await interaction.reply({ content: "🛑 La partie a été arrêtée.", flags: [64] });
                } else if (customId === 'lg_config_composition') {
                    if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier la composition.', flags: [64] });

                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                    const availableRoles = [
                        { label: 'Voyante', value: 'seer', emoji: '🔮' },
                        { label: 'Sorcière', value: 'witch', emoji: '🧪' },
                        { label: 'Chasseur', value: 'hunter', emoji: '🔫' },
                        { label: 'Cupidon', value: 'cupid', emoji: '💘' },
                        { label: 'Garde', value: 'guard', emoji: '🛡️' },
                        { label: 'Mentaliste', value: 'mentalist', emoji: '🧠' },
                        { label: 'Fossoyeur', value: 'gravedigger', emoji: '⚰️' },
                        { label: 'Dictateur', value: 'dictator', emoji: '👑' },
                        { label: 'Loup Blanc', value: 'white_werewolf', emoji: '⚪' },
                        { label: 'Corbeau', value: 'crow', emoji: '🐦' },
                        { label: 'Ancien', value: 'elder', emoji: '👴' },
                        { label: 'Héritier', value: 'heir', emoji: '📜' },
                        { label: 'Loup Noir', value: 'black_werewolf', emoji: '🖤' },
                        { label: 'Sorcier', value: 'sorcerer', emoji: '🧙‍♂️' },
                        { label: 'Pyromane', value: 'pyromaniac', emoji: '🔥' },
                        { label: 'Enfant Sauvage', value: 'wild_child', emoji: '🏹' },
                        { label: 'Loup-Garou', value: 'werewolf', emoji: '🐺' },
                        { label: 'Villageois', value: 'villager', emoji: '🛖' }
                    ];

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_set_composition')
                        .setPlaceholder('Choisir les rôles actifs')
                        .setMinValues(1)
                        .setMaxValues(availableRoles.length)
                        .addOptions(availableRoles.map(r => ({
                            label: r.label,
                            value: r.value,
                            emoji: r.emoji,
                            default: game.customRoles.includes(r.value)
                        })));

                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({
                        content: '⚙️ **Configuration de la composition**\nSélectionnez les rôles spéciaux que vous voulez inclure. Les places restantes seront comblées par des Villageois.',
                        components: [row],
                        flags: [64]
                    });
                } else if (customId.startsWith('imagine_regenerate_')) {
                    const userId = customId.split('_')[2];
                    if (interaction.user.id !== userId) {
                        return interaction.reply({ content: '❌ Seul l\'auteur peut régénérer cette image.', flags: [64] });
                    }

                    const cache = interaction.client.imageCache?.get(userId);
                    if (!cache) {
                        return interaction.reply({ content: '❌ Données de régénération expirées.', flags: [64] });
                    }

                    // Vérifier le cooldown
                    const imageCooldown = require('../systems/imageCooldown');
                    const cooldownCheck = await imageCooldown.checkCooldown(interaction.guild.id, userId);
                    if (!cooldownCheck.allowed) {
                        return interaction.reply({
                            content: `⏱️ Tu as atteint la limite. Réessaye dans **${cooldownCheck.resetIn} minute(s)**.`,
                            flags: [64]
                        });
                    }

                    await interaction.deferUpdate();
                    // Relancer la génération avec les mêmes paramètres
                    const command = interaction.client.commands.get('imagine');
                    if (command) {
                        // Simuler l'exécution avec les paramètres cachés
                        interaction.options = {
                            getString: (name) => name === 'prompt' ? cache.prompt : cache.style,
                            getBoolean: () => false
                        };
                        await command.execute(interaction);
                    }
                } else if (customId.startsWith('imagine_delete_')) {
                    const userId = customId.split('_')[2];
                    if (interaction.user.id !== userId) {
                        return interaction.reply({ content: '❌ Seul l\'auteur peut supprimer cette image.', flags: [64] });
                    }

                    await interaction.message.delete();
                    await interaction.reply({ content: '🗑️ Image supprimée.', flags: [64] });
                } else if (customId === 'lg_witch_save') {
                    game.nightActions.witchAction = { type: 'SAVE', targetId: game.nightActions.wolfTargetId };
                    await interaction.reply({ content: "🧪 Potion de vie utilisée !", flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_witch_kill') {
                    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_witch_kill_target')
                        .setPlaceholder('Choisir qui empoisonner')
                        .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({ content: "🧪 Choisissez votre cible pour la potion de mort :", components: [row], flags: [64] });
                } else if (customId === 'lg_witch_skip') {
                    game.nightActions.witchAction = { type: 'SKIP' };
                    await interaction.reply({ content: "🧪 Tu n'utilises aucune potion.", flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_dictator_takeover') {
                    const player = game.players.get(interaction.user.id);
                    if (player && player.role.id === 'dictator' && player.role.hasPower) {
                        player.role.hasPower = false;
                        game.hasDictatorTakenOver = true;
                        await interaction.reply({ content: "👑 Tu as pris le pouvoir ! Tu seras le seul à voter aujourd'hui.", flags: [64] });
                        await game.thread.send(`👑 **<@${player.id}> a pris le pouvoir !** Préparez-vous à sa sentence.`);
                    }
                } else if (customId === 'lg_dictator_skip') {
                    await interaction.reply({ content: "👑 Tu décides de laisser le village voter aujourd'hui.", flags: [64] });
                } else if (customId === 'lg_pyro_gas_menu') {
                    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_pyro_gas_select')
                        .setPlaceholder('Choisir jusqu\'à 2 joueurs')
                        .setMinValues(1)
                        .setMaxValues(Math.min(2, alivePlayers.length))
                        .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({ content: "🧴 Choisis tes victimes :", components: [row], flags: [64] });
                } else if (customId === 'lg_pyro_burn') {
                    game.nightActions.pyroAction = 'BURN';
                    await interaction.reply({ content: "🔥 **L'INCENDIE VA DÉCOLLER !**", flags: [64] });
                    await game.checkNightEnd();
                }
            } else if (customId.startsWith('profile_')) {
                // Gestion des boutons de profil
                const { getProfile, updateProfile, getAllBackgrounds, formatBadges, getAllBadges, RARITY_COLORS, checkAndAwardBadges } = require('../systems/profiles');
                const { getUserSubscription } = require('../services/subscriptions');
                const guildId = interaction.guild.id;
                const userId = interaction.user.id;

                if (customId === 'profile_edit_bio') {
                    // Envoyer un modal pour éditer la bio
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

                    const modal = new ModalBuilder()
                        .setCustomId('profile_bio_modal')
                        .setTitle('Modifier ta bio');

                    const bioInput = new TextInputBuilder()
                        .setCustomId('bio_input')
                        .setLabel('Ta nouvelle bio')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(200)
                        .setRequired(false)
                        .setPlaceholder('Écris quelque chose sur toi...');

                    modal.addComponents(new ActionRowBuilder().addComponents(bioInput));
                    await interaction.showModal(modal);

                } else if (customId === 'profile_edit_background') {
                    const subscription = await getUserSubscription(userId);
                    const isPremium = subscription.tier.id !== 'free';
                    const backgrounds = getAllBackgrounds();
                    const profile = await getProfile(userId, guildId);

                    const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

                    const options = backgrounds.map(bg => ({
                        label: bg.name,
                        value: bg.id,
                        description: bg.premium ? '⭐ Premium requis' : 'Gratuit',
                        emoji: bg.premium && !isPremium ? '🔒' : '🎨',
                        default: profile.background === bg.id
                    }));

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('profile_background_select')
                                .setPlaceholder('Choisir un background')
                                .addOptions(options)
                        );

                    const embed = new EmbedBuilder()
                        .setTitle('🎨 Choisis ton background')
                        .setDescription(isPremium
                            ? 'Tu as accès à tous les backgrounds !'
                            : 'Les backgrounds avec 🔒 nécessitent un abonnement Premium.')
                        .setColor(profile.accentColor || '#febc11');

                    await interaction.reply({ embeds: [embed], components: [row], flags: [64] });

                } else if (customId === 'profile_view_badges') {
                    const profile = await getProfile(userId, guildId);
                    const userBadges = profile.badges || [];
                    const allBadges = getAllBadges();

                    const newBadges = await checkAndAwardBadges(userId, guildId, interaction.member);

                    let description = '';
                    const ownedBadges = allBadges.filter(b => userBadges.includes(b.id));

                    if (ownedBadges.length > 0) {
                        description += '**Tes badges :**\n';
                        ownedBadges.forEach(badge => {
                            description += `${badge.emoji} **${badge.name}** - ${badge.description}\n`;
                        });
                        description += '\n';
                    }

                    const missingBadges = allBadges.filter(b => !userBadges.includes(b.id) && b.rarity !== 'special');
                    if (missingBadges.length > 0) {
                        description += '**Badges à débloquer :**\n';
                        missingBadges.slice(0, 10).forEach(badge => {
                            description += `🔒 ~~${badge.emoji} ${badge.name}~~ - ${badge.description}\n`;
                        });
                    }

                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('🏅 Collection de Badges')
                        .setDescription(description || 'Aucun badge pour l\'instant.')
                        .setColor(profile.accentColor || '#febc11')
                        .setFooter({ text: `${ownedBadges.length}/${allBadges.filter(b => b.rarity !== 'special').length} badges collectés` });

                    if (newBadges.length > 0) {
                        const newBadgesList = newBadges.map(b => `${b.emoji} ${b.name}`).join(', ');
                        embed.addFields({ name: '🎉 Nouveaux badges débloqués !', value: newBadgesList });
                    }

                    await interaction.reply({ embeds: [embed], flags: [64] });
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;
            if (customId.startsWith('lg_')) {
                const manager = interaction.client.werewolf;
                // Recherche robuste de la partie
                let game = null;
                const channel = interaction.channel || interaction.message?.channel;

                // 1. Essai via le mapping joueur (le plus sûr pour les DMs)
                game = manager.getGameByPlayerId(interaction.user.id);

                // 2. Si pas trouvé (ou au cas où), essai via le salon/thread
                if (!game && channel) {
                    if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
                        game = manager.getGame(channel.parentId);
                    } else {
                        game = manager.getGame(channel.id);
                    }
                }

                if (!game) {
                    return interaction.reply({ content: "❌ Impossible de trouver ta partie en cours. Elle est peut-être terminée.", flags: [64] });
                }

                if (customId === 'lg_set_composition') {
                    if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier la composition.', flags: [64] });
                    game.customRoles = values;
                    await interaction.reply({ content: `✅ Composition mise à jour ! (${values.length} rôles sélectionnés).`, flags: [64] });
                } else if (customId === 'lg_wolf_vote') {
                    game.nightActions.wolfVotes.set(interaction.user.id, values[0]);
                    await interaction.reply({ content: `🐺 Vote enregistré contre <@${values[0]}>.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_seer_action') {
                    const target = game.players.get(values[0]);
                    game.nightActions.seerTargetId = values[0];
                    await interaction.reply({ content: `🔮 La boule de cristal révèle que <@${values[0]}> est : **${target.role.name}** !`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_mayor_vote') {
                    const candidateId = values[0];
                    const player = game.players.get(interaction.user.id);
                    if (!player.isAlive) return interaction.reply({ content: '❌ Les morts ne votent pas !', flags: [64] });

                    player.mayorVote = candidateId;

                    // Vote Public
                    const candidate = game.players.get(candidateId);
                    await game.thread.send(`🗳️ **${interaction.user.username}** a voté pour **${candidate.username}** pour être Maire !`);

                    await interaction.reply({ content: `✅ Vote pour ${candidate.username} enregistré.`, flags: [64] });
                } else if (customId === 'lg_village_vote') {
                    const targetId = values[0];
                    const player = game.players.get(interaction.user.id);
                    if (!player.isAlive) return interaction.reply({ content: '❌ Les morts ne votent pas !', flags: [64] });

                    // Gestion vote précédent
                    const oldTarget = player.voteTarget ? game.players.get(player.voteTarget) : null;
                    player.voteTarget = targetId;

                    // Vote Public
                    const target = game.players.get(targetId);
                    if (oldTarget && oldTarget.id !== targetId) {
                        await game.thread.send(`🗳️ **${interaction.user.username}** a changé son vote : **${oldTarget.username}** ➔ **${target.username}**.`);
                    } else if (!oldTarget) {
                        await game.thread.send(`🗳️ **${interaction.user.username}** a voté contre **${target.username}**.`);
                    }

                    await interaction.reply({ content: `✅ Vote contre ${target.username} enregistré.`, flags: [64] });
                } else if (customId === 'lg_guard_action') {
                    game.nightActions.guardTargetId = values[0];
                    const role = game.players.get(interaction.user.id).role;
                    role.lastProtectedId = values[0];
                    await interaction.reply({ content: `🛡️ Tu protèges <@${values[0]}> cette nuit.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_dictator_vote') {
                    const player = game.players.get(interaction.user.id);
                    player.voteTarget = values[0];
                    const target = game.players.get(values[0]);
                    await game.thread.send(`👑 **Par décret dictatorial**, <@${player.id}> a désigné sa cible : **${target.username}**.`);
                    await interaction.reply({ content: `✅ Décret acté contre ${target.username}.`, flags: [64] });
                    // Immediate resolution of the day
                    game.clearTimers();
                    await game.handleVillageVoteResult();
                } else if (customId === 'lg_cupid_action') {
                    game.nightActions.cupidTargets = values;
                    await interaction.reply({ content: `💘 Tu as lié <@${values[0]}> et <@${values[1]}> par les liens du destin.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_white_wolf_action') {
                    game.nightActions.whiteWolfTargetId = values[0];
                    if (values[0] !== 'skip') {
                        await interaction.reply({ content: `⚪ Tu dévoreras <@${values[0]}> cette nuit.`, flags: [64] });
                    } else {
                        await interaction.reply({ content: `⚪ Tu as décidé de rester sage cette nuit.`, flags: [64] });
                    }
                    await game.checkNightEnd();
                } else if (customId === 'lg_crow_action') {
                    game.nightActions.crowTargetId = values[0];
                    await interaction.reply({ content: `🐦 La malédiction s'abat sur <@${values[0]}>.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_black_wolf_infection') {
                    game.nightActions.blackWolfInfectedId = values[0];
                    if (values[0] !== 'skip') {
                        await interaction.reply({ content: `🖤 Tu as choisi d'infecter <@${values[0]}> !`, flags: [64] });
                    } else {
                        await interaction.reply({ content: `🖤 Tu as décidé de ne pas utiliser ton pouvoir ce soir.`, flags: [64] });
                    }
                    await game.checkNightEnd();
                } else if (customId === 'lg_heir_action') {
                    const player = game.players.get(interaction.user.id);
                    if (player) player.role.targetId = values[0];
                    await interaction.reply({ content: `📜 Tes volontés sont scellées. Ton protecteur est <@${values[0]}>.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_wild_child_action') {
                    const player = game.players.get(interaction.user.id);
                    if (player) player.role.modelId = values[0];
                    await interaction.reply({ content: `🏹 Ton modèle est désormais <@${values[0]}>.`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_pyro_gas_menu') {
                    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_pyro_gas_select')
                        .setPlaceholder('Choisir jusqu\'à 2 victimes')
                        .setMinValues(1).setMaxValues(Math.min(2, alivePlayers.length))
                        .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
                    await interaction.reply({ content: '🧴 Qui voulez-vous gazer ?', components: [new ActionRowBuilder().addComponents(select)], flags: [64] });
                } else if (customId === 'lg_pyro_burn') {
                    game.nightActions.pyroAction = 'BURN';
                    await interaction.reply({ content: '🔥 **L\'INCENDIE SERA DÉCLENCHÉ CETTE NUIT !**', flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_pyro_gas_select') {
                    game.nightActions.pyroGasTargetIds = values;
                    game.nightActions.pyroAction = 'GAS';
                    await interaction.reply({ content: `🧴 Tu as gazé **${values.length}** joueur(s).`, flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_hunter_action') {
                    const victimId = values[0];
                    await game.applyDeath(victimId);
                    await interaction.reply({ content: `🔫 Pan ! Tu as abattu <@${values[0]}> dans ton dernier souffle.`, flags: [64] });
                    await game.thread.send(`🔫 Un coup de feu retentit... Dans son dernier souffle, le Chasseur a abattu <@${values[0]}> qui était **${game.players.get(values[0]).role.name}**.`);
                    if (game.state === 'DAY_VOTING' || game.state === 'NIGHT') {
                        await game.checkWinCondition();
                    }
                } else if (customId === 'lg_witch_save') {
                    game.nightActions.witchAction = { type: 'SAVE', targetId: game.nightActions.wolfTargetId };
                    const role = game.players.get(interaction.user.id).role;
                    role.hasLifePotion = false;
                    await interaction.reply({ content: '🧪 Tu as utilisé ta potion de vie !', flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_witch_kill') {
                    const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_witch_kill_target')
                        .setPlaceholder('Choisir une victime')
                        .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
                    await interaction.reply({ content: '🧪 Qui voulez-vous empoisonner ?', components: [new ActionRowBuilder().addComponents(select)], flags: [64] });
                } else if (customId === 'lg_witch_skip') {
                    game.nightActions.witchAction = { type: 'SKIP' };
                    await interaction.reply({ content: '🧪 Tu as décidé de ne pas agir.', flags: [64] });
                    await game.checkNightEnd();
                } else if (customId === 'lg_witch_kill_target') {
                    const victimId = values[0];
                    game.nightActions.witchAction = { type: 'KILL', targetId: victimId };
                    const role = game.players.get(interaction.user.id).role;
                    role.hasDeathPotion = false;
                    await interaction.reply({ content: `🧪 Tu as choisi d'éliminer <@${victimId}> !`, flags: [64] });
                    await game.checkNightEnd();
                }
            } else if (customId === 'profile_background_select') {
                // Handler pour la sélection de background
                const { getProfile, updateProfile, getAllBackgrounds } = require('../systems/profiles');
                const { getUserSubscription } = require('../services/subscriptions');
                const guildId = interaction.guild.id;
                const userId = interaction.user.id;

                const selectedBg = values[0];
                const backgrounds = getAllBackgrounds();
                const bgInfo = backgrounds.find(b => b.id === selectedBg);

                if (!bgInfo) {
                    return interaction.reply({ content: '❌ Background invalide.', flags: [64] });
                }

                // Vérifier si c'est un background premium
                if (bgInfo.premium) {
                    const subscription = await getUserSubscription(userId);
                    if (subscription.tier.id === 'free') {
                        return interaction.reply({
                            content: '⭐ Ce background nécessite un abonnement **Premium**.',
                            flags: [64]
                        });
                    }
                }

                await updateProfile(userId, guildId, { background: selectedBg });

                await interaction.reply({
                    content: `✅ Background mis à jour : **${bgInfo.name}**`,
                    flags: [64]
                });
            }
        } else if (interaction.isModalSubmit()) {
            // Gestion des modals
            const { customId } = interaction;

            if (customId === 'profile_bio_modal') {
                const { updateProfile } = require('../systems/profiles');
                const guildId = interaction.guild.id;
                const userId = interaction.user.id;

                const bio = interaction.fields.getTextInputValue('bio_input') || '';

                await updateProfile(userId, guildId, { bio });

                await interaction.reply({
                    content: bio ? `✅ Ta bio a été mise à jour :\n*"${bio}"*` : '✅ Ta bio a été supprimée.',
                    flags: [64]
                });
            }
        }
    }
};
