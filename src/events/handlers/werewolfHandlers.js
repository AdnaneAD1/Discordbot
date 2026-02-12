const { ChannelType, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

async function handleWerewolfInteraction(interaction) {
    const customId = interaction.customId;
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

    // Vérification Powerless (Ancien tué par le village)
    const player = game.players.get(interaction.user.id);
    const roleActions = ['lg_witch_save', 'lg_witch_kill', 'lg_witch_kill_target', 'lg_seer_action', 'lg_guard_action', 'lg_crow_action', 'lg_pyro_gas_menu', 'lg_pyro_gas_select', 'lg_pyro_burn', 'lg_hunter_action', 'lg_mentalist_action', 'lg_heir_action', 'lg_wild_child_action'];

    if (player && player.powerless && roleActions.some(action => customId.startsWith(action))) {
        if (player.role.team === 'VILLAGE') {
            return interaction.reply({ content: "❌ Tu as perdu tes pouvoirs car l'Ancien a été tué par le village.", flags: [64] });
        }
    }

    // --- Buttons ---
    if (interaction.isButton()) {
        if (customId === 'lg_join') {
            if (await game.addPlayer(interaction.user)) {
                await game.updateLobby();
                await interaction.reply({ content: "✅ Tu as rejoint la partie !", flags: [64] });
            } else {
                await interaction.reply({ content: "⚠️ Tu es déjà dans la partie.", flags: [64] });
            }
        } else if (customId === 'lg_leave') {
            if (await game.removePlayer(interaction.user.id)) {
                await game.updateLobby();
                await interaction.reply({ content: "👋 Tu as quitté la partie.", flags: [64] });
            } else {
                await interaction.reply({ content: "⚠️ Tu n'es pas dans la partie.", flags: [64] });
            }
        } else if (customId === 'lg_start') {
            if (interaction.user.id !== game.host.id) {
                return interaction.reply({ content: "❌ Seul l'hôte peut lancer la partie.", flags: [64] });
            }
            await interaction.deferUpdate();
            await game.start();
        } else if (customId === 'lg_stop') {
            if (interaction.user.id !== game.host.id && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: "❌ Seul l'hôte ou un admin peut arrêter la partie.", flags: [64] });
            }
            await game.stop();
            await interaction.reply({ content: "🛑 La partie a été arrêtée.", flags: [64] });
        } else if (customId === 'lg_config_composition') {
            if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier la composition.', flags: [64] });

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
        } else if (customId === 'lg_config_theme') {
            if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier le thème.', flags: [64] });

            const { isGuildPremium } = require('../../services/subscriptions');
            const premiumStatus = await isGuildPremium(interaction.guild.id);

            if (!premiumStatus.isPremium || (premiumStatus.tier.id !== 'premium_plus')) {
                return interaction.reply({
                    content: '👑 **Les thèmes visuels sont réservés aux serveurs Premium+ !**\nAméliorez votre abonnement pour débloquer cette personnalisation.',
                    flags: [64]
                });
            }

            const availableThemes = [
                { label: 'Classique', value: 'default', emoji: '🐺' },
                { label: 'Forêt Royale', value: 'forest', emoji: '🌲' },
                { label: 'Obsidienne (Sombre)', value: 'dark', emoji: '🌑' },
                { label: 'Lune de Sang', value: 'bloody', emoji: '🩸' }
            ];

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_set_theme')
                .setPlaceholder('Choisir une ambiance visuelle')
                .addOptions(availableThemes.map(t => ({
                    label: t.label,
                    value: t.value,
                    emoji: t.emoji,
                    default: game.themeId === t.value
                })));

            const row = new ActionRowBuilder().addComponents(select);
            await interaction.reply({
                content: '🎨 **Ambiance Visuelle**\nChoisissez le thème qui sera appliqué aux messages et aux cartes de rôles de la partie.',
                components: [row],
                flags: [64]
            });
        } else if (customId === 'lg_witch_save') {
            if (game.state !== 'NIGHT_RESOLUTION') return interaction.reply({ content: '❌ Trop tard pour utiliser la potion.', flags: [64] });
            game.nightActions.witchActions.save = game.nightActions.wolfTargetId;
            const role = game.players.get(interaction.user.id).role;
            role.hasLifePotion = false;
            await interaction.reply({ content: "🧪 Potion de vie utilisée !", flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_witch_kill') {
            const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_witch_kill_target')
                .setPlaceholder('Choisir qui empoisonner')
                .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
            const row = new ActionRowBuilder().addComponents(select);
            await interaction.reply({ content: "🧪 Choisissez votre cible pour la potion de mort :", components: [row], flags: [64] });
        } else if (customId === 'lg_witch_skip') {
            game.nightActions.witchActions.skip = true;
            await interaction.reply({ content: "🧪 Tu n'utilises aucune potion.", flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_dictator_takeover') {
            const player = game.players.get(interaction.user.id);
            if (player && player.role.id === 'dictator' && player.role.hasPower) {
                player.role.hasPower = false;
                game.hasDictatorTakenOver = true;
                await interaction.reply({ content: "👑 Tu as pris le pouvoir ! Tu seras le seul à voter aujourd'hui.", flags: [64] });
                await game.thread.send(`👑 **<@${player.id}> a pris le pouvoir !** Préparez-vous à sa sentence.`);

                const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
                const select = new StringSelectMenuBuilder()
                    .setCustomId('lg_dictator_vote')
                    .setPlaceholder('Qui condamner à mort ?')
                    .addOptions(alivePlayers.map(p => ({ label: p.username, value: p.id })));
                const row = new ActionRowBuilder().addComponents(select);
                await interaction.followUp({ content: "⚖️ **À toi de juger.** Choisis ta victime :", components: [row], flags: [64] });
            }
        } else if (customId === 'lg_dictator_skip') {
            await interaction.reply({ content: "👑 Tu décides de laisser le village voter aujourd'hui.", flags: [64] });
        } else if (customId === 'lg_pyro_gas_menu') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ Attends la nuit pour agir.', flags: [64] });
            const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== interaction.user.id);
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
    }

    // --- Select Menus ---
    if (interaction.isStringSelectMenu()) {
        const values = interaction.values;
        if (customId === 'lg_set_composition') {
            if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier la composition.', flags: [64] });
            game.customRoles = values;
            await interaction.reply({ content: `✅ Composition mise à jour ! (${values.length} rôles sélectionnés).`, flags: [64] });
        } else if (customId === 'lg_set_theme') {
            if (interaction.user.id !== game.host.id) return interaction.reply({ content: '❌ Seul l\'hôte peut modifier le thème.', flags: [64] });
            const success = game.setTheme(values[0]);
            if (success) {
                await game.updateLobby();
                await interaction.reply({ content: `🎨 Thème mis à jour : **${values[0]}** !`, flags: [64] });
            } else {
                await interaction.reply({ content: '❌ Thème introuvable.', flags: [64] });
            }
        } else if (customId === 'lg_wolf_vote') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ Ce n\'est pas le moment de chasser.', flags: [64] });
            game.nightActions.wolfVotes.set(interaction.user.id, values[0]);
            await interaction.reply({ content: `🐺 Vote enregistré contre <@${values[0]}>.`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_seer_action') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ La boule de cristal est trouble le jour.', flags: [64] });
            const target = game.players.get(values[0]);
            game.nightActions.seerTargetId = values[0];
            await interaction.reply({ content: `🔮 La boule de cristal révèle que <@${values[0]}> est : **${target.role.name}** !`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_mayor_vote') {
            const candidateId = values[0];
            const player = game.players.get(interaction.user.id);
            if (game.turn !== 1 || game.state !== 'NIGHT') return interaction.reply({ content: '❌ Les votes pour le Maire sont clos.', flags: [64] });
            if (!player.isAlive) return interaction.reply({ content: '❌ Les morts ne votent pas !', flags: [64] });

            player.mayorVote = candidateId;
            const candidate = game.players.get(candidateId);
            await game.thread.send(`🗳️ **${interaction.user.displayName}** a voté pour **${candidate.username}** pour être Maire !`);
            await interaction.reply({ content: `✅ Vote pour ${candidate.username} enregistré.`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_village_vote') {
            if (game.state !== 'DAY_VOTING') return interaction.reply({ content: '❌ Ce n\'est pas le moment de voter.', flags: [64] });
            const targetId = values[0];
            const player = game.players.get(interaction.user.id);
            if (!player.isAlive) return interaction.reply({ content: '❌ Les morts ne votent pas !', flags: [64] });

            const oldTarget = player.voteTarget ? game.players.get(player.voteTarget) : null;
            player.voteTarget = targetId;
            const target = game.players.get(targetId);
            if (oldTarget && oldTarget.id !== targetId) {
                await game.thread.send(`🗳️ **${interaction.user.displayName}** a changé son vote : **${oldTarget.username}** ➔ **${target.username}**.`);
            } else if (!oldTarget) {
                await game.thread.send(`🗳️ **${interaction.user.displayName}** a voté contre **${target.username}**.`);
            }
            await interaction.reply({ content: `✅ Vote contre ${target.username} enregistré.`, flags: [64] });
        } else if (customId === 'lg_guard_action') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ Tu ne peux monter la garde que la nuit.', flags: [64] });
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
            game.clearTimers();
            await game.handleVillageVoteResult();
        } else if (customId === 'lg_cupid_action') {
            if (game.state !== 'NIGHT' || game.turn !== 1) return interaction.reply({ content: '❌ Cupidon ne tire ses flèches qu\'au premier soir.', flags: [64] });
            game.nightActions.cupidTargets = values;
            await interaction.reply({ content: `💘 Tu as lié <@${values[0]}> et <@${values[1]}> par les liens du destin.`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_white_wolf_action') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ La faim du Loup Blanc ne s\'exprime que la nuit.', flags: [64] });
            game.nightActions.whiteWolfTargetId = values[0];
            if (values[0] !== 'skip') {
                await interaction.reply({ content: `⚪ Tu dévoreras <@${values[0]}> cette nuit.`, flags: [64] });
            } else {
                await interaction.reply({ content: `⚪ Tu as décidé de rester sage cette nuit.`, flags: [64] });
            }
            await game.checkNightEnd();
        } else if (customId === 'lg_crow_action') {
            if (game.state !== 'NIGHT') return interaction.reply({ content: '❌ Le Corbeau ne sort que la nuit.', flags: [64] });
            game.nightActions.crowTargetId = values[0];
            await interaction.reply({ content: `🐦 La malédiction s'abat sur <@${values[0]}>.`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_black_wolf_infection') {
            if (game.state !== 'NIGHT_RESOLUTION') return interaction.reply({ content: '❌ Le moment de l\'infection est passé.', flags: [64] });
            game.nightActions.blackWolfInfectedId = values[0];
            if (values[0] !== 'skip') {
                const target = game.players.get(values[0]);
                if (target && (target.role.team === 'WEREWOLF' || target.role.id === 'white_werewolf')) {
                    return interaction.reply({ content: '❌ Tu ne peux pas infecter un membre de ta propre espèce !', flags: [64] });
                }
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
        } else if (customId === 'lg_pyro_gas_select') {
            game.nightActions.pyroGasTargetIds = values;
            game.nightActions.pyroAction = 'GAS';
            await interaction.reply({ content: `🧴 Tu as gazé **${values.length}** joueur(s).`, flags: [64] });
            await game.checkNightEnd();
        } else if (customId === 'lg_hunter_action') {
            const victimId = values[0];
            await interaction.reply({ content: `🔫 Pan ! Tu as abattu <@${values[0]}> dans ton dernier souffle.`, flags: [64] });
            await game.handleHunterAction(victimId);
            await game.thread.send(`🔫 Un coup de feu retentit... Dans son dernier souffle, le Chasseur a abattu <@${values[0]}> qui était **${game.players.get(values[0]).role.name}**.`);
        } else if (customId === 'lg_mayor_successor') {
            const successorId = values[0];
            game.mayorId = successorId;
            const successor = game.players.get(successorId);
            await interaction.reply({ content: `🎖️ Tu as transmis tes pouvoirs à <@${successorId}> !`, flags: [64] });
            await game.thread.send(`🎖️ Dans son dernier souffle, l'ancien Maire a désigné **${successor.username}** comme son successeur !`);
        } else if (customId === 'lg_witch_kill_target') {
            const victimId = values[0];
            game.nightActions.witchActions.kill = victimId;
            const role = game.players.get(interaction.user.id).role;
            role.hasDeathPotion = false;
            await interaction.reply({ content: `🧪 Tu as choisi d'éliminer <@${victimId}> !`, flags: [64] });
            await game.checkNightEnd();
        }
    }
}

module.exports = { handleWerewolfInteraction };
