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
                }
            } else if (customId.startsWith('lg_')) {
                // Gestion des boutons Loup-Garou
                const manager = interaction.client.werewolf;
                const game = manager.getGame(interaction.message.channel.id);

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
                        return interaction.reply({ content: '❌ Seul l\'auteur peut supprimer cette image.', ephemeral: true });
                    }

                    await interaction.message.delete();
                    await interaction.reply({ content: '🗑️ Image supprimée.', ephemeral: true });
                } else if (customId === 'lg_witch_save') {
                    game.nightActions.witchAction = { type: 'SAVE', targetId: game.nightActions.wolfTargetId };
                    await interaction.reply({ content: "🧪 Potion de vie utilisée !", ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_witch_kill') {
                    // TODO: Implement kill target select menu for witch
                    await interaction.reply({ content: "🧪 Potion de mort non encore implémentée pour le choix de cible.", ephemeral: true });
                } else if (customId === 'lg_witch_skip') {
                    game.nightActions.witchAction = { type: 'SKIP' };
                    await interaction.reply({ content: "🧪 Tu n'utilises aucune potion.", ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_dictator_takeover') {
                    const player = game.players.get(interaction.user.id);
                    if (player && player.role.id === 'dictator' && player.role.hasPower) {
                        player.role.hasPower = false;
                        game.hasDictatorTakenOver = true;
                        await interaction.reply({ content: "👑 Tu as pris le pouvoir ! Tu seras le seul à voter aujourd'hui.", ephemeral: true });
                        await game.thread.send(`👑 **<@${player.id}> a pris le pouvoir !** Préparez-vous à sa sentence.`);
                    }
                } else if (customId === 'lg_dictator_skip') {
                    await interaction.reply({ content: "👑 Tu décides de laisser le village voter aujourd'hui.", ephemeral: true });
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
                    await interaction.reply({ content: "🧴 Choisis tes victimes :", components: [row], ephemeral: true });
                } else if (customId === 'lg_pyro_burn') {
                    game.nightActions.pyroAction = 'BURN';
                    await interaction.reply({ content: "🔥 **L'INCENDIE VA DÉCOLLER !**", ephemeral: true });
                    await game.checkNightEnd();
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;
            if (customId.startsWith('lg_')) {
                const manager = interaction.client.werewolf;
                // Note: select menus are often in private threads or DMs, 
                // but the interaction.channel might be the thread.
                const game = interaction.channel.type === ChannelType.PublicThread || interaction.channel.type === ChannelType.PrivateThread
                    ? manager.getGame(interaction.channel.parentId)
                    : manager.getGame(interaction.channel.id);
                // Si c'est un DM, on n'a pas interaction.message.channel.id facilement lié au game sans stocker plus d'infos.
                // TODO: Trouver une meilleure façon de lier les DMs au jeu actif.
                // En attendant, on assume que tout se passe dans les threads.

                if (!game) return;

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
                    await interaction.reply({ content: `🔮 La boule de cristal révèle que <@${values[0]}> est : **${target.role.name}** !`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_dictator_vote') {
                    const player = game.players.get(interaction.user.id);
                    if (player && game.hasDictatorTakenOver) {
                        player.voteTarget = values[0];
                        await interaction.reply({ content: `⚖️ Sentence capitale prononcée contre <@${values[0]}>.`, ephemeral: true });
                    }
                } else if (customId === 'lg_mayor_vote') {
                    const player = game.players.get(interaction.user.id);
                    if (player) {
                        player.mayorVote = values[0];
                        await interaction.reply({ content: `🗳️ Tu as voté pour <@${values[0]}> comme Maire.`, ephemeral: true });
                    }
                } else if (customId === 'lg_guard_action') {
                    game.nightActions.guardTargetId = values[0];
                    const role = game.players.get(interaction.user.id).role;
                    role.lastProtectedId = values[0];
                    await interaction.reply({ content: `🛡️ Tu protèges <@${values[0]}> cette nuit.`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_cupid_action') {
                    game.nightActions.cupidTargets = values;
                    await interaction.reply({ content: `💘 Tu as lié <@${values[0]}> et <@${values[1]}> par les liens du destin.`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_white_wolf_action') {
                    game.nightActions.whiteWolfTargetId = values[0];
                    if (values[0] !== 'skip') {
                        await interaction.reply({ content: `⚪ Tu dévoreras <@${values[0]}> cette nuit.`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: `⚪ Tu as décidé de rester sage cette nuit.`, ephemeral: true });
                    }
                    await game.checkNightEnd();
                } else if (customId === 'lg_crow_action') {
                    game.nightActions.crowTargetId = values[0];
                    await interaction.reply({ content: `🐦 La malédiction s'abat sur <@${values[0]}>.`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_black_wolf_infection') {
                    game.nightActions.blackWolfInfectedId = values[0];
                    if (values[0] !== 'skip') {
                        await interaction.reply({ content: `🖤 Tu as choisi d'infecter <@${values[0]}> !`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: `🖤 Tu as décidé de ne pas utiliser ton pouvoir ce soir.`, ephemeral: true });
                    }
                    await game.checkNightEnd();
                } else if (customId === 'lg_wild_child_action') {
                    const player = game.players.get(interaction.user.id);
                    if (player) player.role.modelId = values[0];
                    await interaction.reply({ content: `🏹 Ton modèle est désormais <@${values[0]}>.`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_pyro_gas_select') {
                    game.nightActions.pyroGasTargetIds = values;
                    game.nightActions.pyroAction = 'GAS';
                    await interaction.reply({ content: `🧴 Tu as gazé **${values.length}** joueur(s).`, ephemeral: true });
                    await game.checkNightEnd();
                } else if (customId === 'lg_hunter_action') {
                    const victimId = values[0];
                    await game.applyDeath(victimId);
                    await interaction.reply({ content: `🔫 Pan ! Tu as abattu <@${values[0]}> dans ton dernier souffle.`, ephemeral: true });
                    await game.thread.send(`🔫 Un coup de feu retentit... Dans son dernier souffle, le Chasseur a abattu <@${values[0]}> qui était **${game.players.get(values[0]).role.name}**.`);
                    if (game.state === 'DAY_VOTING' || game.state === 'NIGHT') {
                        await game.checkWinCondition();
                    }
                } else if (customId === 'lg_village_vote') {
                    // Enregistrer ou modifier le vote
                    const player = game.players.get(interaction.user.id);
                    if (!player || !player.isAlive) {
                        return interaction.reply({ content: "❌ Tu ne peux pas voter.", ephemeral: true });
                    }

                    const oldTargetId = player.voteTarget;
                    player.voteTarget = values[0];

                    if (oldTargetId) {
                        await interaction.reply({ content: `⚖️ Vote modifié ! Nouveau vote contre <@${values[0]}>.`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: `⚖️ Tu as voté contre <@${values[0]}>.`, ephemeral: true });
                    }
                }
            }
        }
    }
};
