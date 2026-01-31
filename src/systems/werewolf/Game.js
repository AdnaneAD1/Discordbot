const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, AttachmentBuilder } = require('discord.js');
const Player = require('./Player');
const path = require('path');
const fs = require('fs');
const { recordWerewolfGame } = require('../gameStats');
const { cachePlayersForMentions } = require('../../utils/mentions');

class Game {
    constructor(client, channel, host, manager) {
        this.client = client;
        this.channel = channel;
        this.host = host;
        this.manager = manager;

        this.players = new Map(); // UserID -> Player
        this.playerThreads = new Map(); // UserID -> ThreadChannel (Universal Threads)
        this.state = 'LOBBY'; // LOBBY, NIGHT, DAY, VOTING, END
        this.thread = null; // Thread principal du jeu
        this.wolfThread = null; // Thread privé des loups
        this.nightActions = {
            wolfVotes: new Map(), // VoterID -> TargetID
            wolfTargetId: null,
            seerTargetId: null,
            witchAction: null, // { type: 'SAVE' | 'KILL' | 'SKIP', targetId: string }
            guardTargetId: null,
            cupidTargets: [], // [id1, id2]
            whiteWolfTargetId: null,
            crowTargetId: null,
            blackWolfInfectedId: null,
            pyroGasTargetIds: [],
            pyroAction: null, // 'GAS' or 'BURN'
        };
        this.turn = 0;
        this.lastDead = null; // Pour le Fossoyeur
        this.hasDictatorTakenOver = false; // Pour le Dictateur
        this.mayorId = null; // ID du Maire élu
        this.logs = []; // Journal des événements
        this.customRoles = []; // Liste des IDs de rôles choisis manuellement
        this.roleActionMessages = new Map(); // UserID -> Message (Active action prompt)
    }

    logEvent(message) {
        this.logs.push(`• ${message}`);
    }

    async startLobby() {
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🐺 Loup-Garou - Nouvelle Partie')
            .setDescription(`Le Maire **${this.host.username}** recrute des villageois !\n\n**Joueurs (1/25) :**\n${this.host} (Hôte)`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/1993/1993290.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lg_join').setLabel('Rejoindre').setStyle(ButtonStyle.Success).setEmoji('✋'),
            new ButtonBuilder().setCustomId('lg_leave').setLabel('Quitter').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('lg_start').setLabel('Lancer').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
            new ButtonBuilder().setCustomId('lg_stop').setLabel('Arrêter').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lg_config_composition').setLabel('Composition').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
        );

        this.addPlayer(this.host);

        this.lobbyMessage = await this.channel.send({ embeds: [embed], components: [row, row2] });
    }

    async stop() {
        this.clearTimers();
        this.state = 'END';
        this.manager.endGame(this.channel.id);
        if (this.thread) {
            await this.thread.send("🛑 **La partie a été annulée.** Ce fil sera supprimé dans 10 secondes.");
            this.cleanupThreads(10000);
        }
    }

    async cleanupThreads(delayMs = 0) {
        setTimeout(async () => {
            try {
                if (this.wolfThread) await this.wolfThread.delete().catch(() => { });
                if (this.thread) await this.thread.delete().catch(() => { });

                // Suppression des threads de joueurs
                for (const thread of this.playerThreads.values()) {
                    await thread.delete().catch(() => { });
                }
                this.playerThreads.clear();
            } catch (e) {
                console.error("Error deleting threads:", e);
            }
        }, delayMs);
    }

    addPlayer(user) {
        if (this.players.has(user.id)) return false;
        this.players.set(user.id, new Player(user));
        this.manager.joinGame(user.id, this.channel.id);
        return true;
    }

    removePlayer(userId) {
        if (!this.players.has(userId)) return false;
        this.players.delete(userId);
        this.manager.leaveGame(userId);
        return true;
    }

    async updateLobby() {
        if (!this.lobbyMessage) return;

        const playerList = Array.from(this.players.values()).map(p => `<@${p.id}>`).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🐺 Loup-Garou - Recrutement')
            .setDescription(`Le Maire **${this.host.username}** recrute des villageois !\n\n**Joueurs (${this.players.size}/25) :**\n${playerList}`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/1993/1993290.png');

        await this.lobbyMessage.edit({ embeds: [embed] });
    }

    async start() {
        if (this.players.size < 2) { // Dev mode: allowed 2 players
            return this.channel.send("❌ Pas assez de joueurs pour commencer (Min: 4).");
        }

        this.state = 'STARTING';
        await this.lobbyMessage.delete().catch(() => { });
        this.channel.send("🎲 **Lancement de la partie... Distribution des rôles en cours !**");

        // 1. Create Game Thread
        try {
            this.thread = await this.channel.threads.create({
                name: `Loup-Garou - Partie de ${this.host.username}`,
                autoArchiveDuration: 60,
                reason: 'Partie de Loup-Garou'
            });
            await this.thread.send(`📢 **La partie commence !** ${Array.from(this.players.values()).map(p => `<@${p.id}>`).join(', ')}`);
        } catch (e) {
            console.error("Error creating thread:", e);
            return this.channel.send("❌ Impossible de créer le fil de discussion. Vérifiez mes permissions !");
        }

        // 2. Cache all players for proper mention resolution
        await cachePlayersForMentions(this.channel.guild, Array.from(this.players.values()));

        // 3. Distribute Roles
        const roles = this.generateRoles(this.players.size);

        // Fisher-Yates Shuffle for true randomness
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }
        const shuffledRoles = roles;

        // Assign roles
        let i = 0;
        for (const player of this.players.values()) {
            player.assignRole(shuffledRoles[i]);
            i++;
        }
        // 3. Create Universal Player Threads & Send Roles
        await this.createPlayerThreads();

        this.logEvent("Distribution des rôles terminée et fils privés créés.");

        // 4. Start Night
        await this.startNight();
    }

    async createPlayerThreads() {
        // Note: Creating many threads might hit rate limits. We'll do it sequentially with a small delay if needed.
        for (const player of this.players.values()) {
            try {
                // Nom du fil : "Pseudo - Rôle" (ou juste Pseudo pour ne pas spoil si d'autres voient ?)
                // Pour un vrai fil privé, seul le bot et l'user y sont.
                // Sur Discord, PrivateThread nécessite que le bot invite l'user.

                const threadName = `🔒 ${player.username}`;
                const thread = await this.channel.threads.create({
                    name: threadName,
                    type: ChannelType.PrivateThread,
                    autoArchiveDuration: 60,
                    invitable: false
                });

                await thread.members.add(player.id);
                this.playerThreads.set(player.id, thread);

                // Prepare Role Card
                const files = [];
                if (player.role.imagePath) {
                    try {
                        const imgPath = path.resolve(__dirname, '../../assets/roles', player.role.imagePath);
                        if (fs.existsSync(imgPath)) {
                            const attachment = new AttachmentBuilder(imgPath, { name: player.role.imagePath });
                            files.push(attachment);
                        }
                    } catch (e) { console.error("Error checking role image", e); }
                }

                const dmEmbed = new EmbedBuilder()
                    .setTitle(`Tu es ${player.role.name} ${player.role.emoji}`)
                    .setDescription(`**Ton objectif :** ${player.role.description}\n\nCe fil est ton espace privé. C'est ici que tu recevras les informations secrètes et que tu utiliseras tes pouvoirs.`)
                    .setColor(player.role.team === 'WEREWOLF' ? '#ff0000' : '#00ff00');

                if (files.length > 0) {
                    dmEmbed.setThumbnail(`attachment://${player.role.imagePath}`);
                }

                await thread.send({ content: `<@${player.id}>`, embeds: [dmEmbed], files: files });

                // Petite pause pour éviter le rate limit
                await new Promise(r => setTimeout(r, 1000));

            } catch (e) {
                console.error(`Error creating thread for ${player.username}:`, e);
                this.channel.send(`⚠️ Impossible de créer le fil privé pour <@${player.id}>.`);
            }
        }
    }

    generateRoles(count) {
        const Villageois = require('./roles/Villager');
        const LoupGarou = require('./roles/Werewolf');
        const Voyante = require('./roles/Seer');
        const Sorciere = require('./roles/Witch');
        const Chasseur = require('./roles/Hunter');
        const Cupidon = require('./roles/Cupid');
        const Garde = require('./roles/Guard');
        const Mentaliste = require('./roles/Mentalist');
        const Fossoyeur = require('./roles/Gravedigger');
        const Dictateur = require('./roles/Dictator');
        const LoupBlanc = require('./roles/WhiteWerewolf');
        const Corbeau = require('./roles/Crow');
        const Ancien = require('./roles/Elder');
        const Heritier = require('./roles/Heir');
        const LoupNoir = require('./roles/BlackWerewolf');
        const Sorcier = require('./roles/Sorcerer');
        const Pyromane = require('./roles/Pyromaniac');
        const EnfantSauvage = require('./roles/WildChild');

        const roleMap = {
            'seer': Voyante, 'witch': Sorciere, 'hunter': Chasseur, 'cupid': Cupidon,
            'guard': Garde, 'mentalist': Mentaliste, 'gravedigger': Fossoyeur,
            'dictator': Dictateur, 'white_werewolf': LoupBlanc, 'crow': Corbeau,
            'elder': Ancien, 'heir': Heritier, 'black_werewolf': LoupNoir,
            'sorcerer': Sorcier, 'pyromaniac': Pyromane, 'wild_child': EnfantSauvage,
            'villager': Villageois, 'werewolf': LoupGarou
        };

        const roles = [];
        const targetWolfCount = Math.max(1, Math.floor(count / 4));

        // 1. Démarrer avec la compo personnalisée si elle existe
        if (this.customRoles && this.customRoles.length > 0) {
            for (const id of this.customRoles) {
                if (roles.length < count) roles.push(new roleMap[id]());
            }
        }

        // 2. Préparer le "Pool" pour le remplissage intelligent
        // On exclut les loups de base car on les gère par ratio
        const specialVillagers = [Voyante, Sorciere, Chasseur, Cupidon, Garde, Mentaliste, Fossoyeur, Dictateur, Corbeau, Ancien, Heritier, EnfantSauvage];
        const specialEvil = [LoupNoir, Sorcier];
        const neutrals = [LoupBlanc, Pyromane];

        // 3. Remplissage jusqu'au nombre de joueurs
        while (roles.length < count) {
            const currentWolves = roles.filter(r => r.team === 'WEREWOLF' || r.id === 'white_werewolf').length;

            if (currentWolves < targetWolfCount) {
                // On ajoute un loup (soit Spécial soit Normal)
                if (Math.random() > 0.5) {
                    roles.push(new LoupGarou());
                } else {
                    const RoleClass = specialEvil[Math.floor(Math.random() * specialEvil.length)];
                    roles.push(new RoleClass());
                }
            } else {
                // On ajoute un villageois spécial ou neutre (ou simple villageois s'il y en a déjà beaucoup)
                const rand = Math.random();
                if (rand < 0.15) { // 15% de chance pour un Neutre
                    const RoleClass = neutrals[Math.floor(Math.random() * neutrals.length)];
                    roles.push(new RoleClass());
                } else if (rand < 0.85) { // 70% de chance pour un Villageois Spécial
                    const RoleClass = specialVillagers[Math.floor(Math.random() * specialVillagers.length)];
                    // Éviter les doublons de rôles uniques (optionnel mais recommandé)
                    if (!roles.some(r => r instanceof RoleClass)) {
                        roles.push(new RoleClass());
                    } else {
                        roles.push(new Villageois());
                    }
                } else {
                    roles.push(new Villageois());
                }
            }
        }

        // 4. Mélange final
        return roles;
    }

    async startNight() {
        if (this.state === 'END') return; // Loop Safety
        this.state = 'NIGHT';
        this.turn = (this.turn || 0) + 1;

        await this.thread.send(`🌃 **La Nuit tombe sur le village...** (Nuit ${this.turn})\nTout le monde ferme les yeux !`);

        // Handle Werewolves
        const wolves = Array.from(this.players.values()).filter(p => p.role.team === 'WEREWOLF' && p.isAlive);
        if (wolves.length > 0) {
            // Create a private thread for wolves
            try {
                if (!this.wolfThread) {
                    this.wolfThread = await this.channel.threads.create({
                        name: '🐺 Les Loups',
                        type: ChannelType.PrivateThread,
                        autoArchiveDuration: 60
                    });
                    // Add wolves
                    for (const w of wolves) {
                        try {
                            await this.wolfThread.members.add(w.id);
                        } catch (e) { console.error("Error adding wolf to thread", e); }
                    }
                }

                await this.wolfThread.send(`🐺 **C'est la nuit !** Choisissez votre victime.`);

                const aliveVillagers = Array.from(this.players.values()).filter(p => p.isAlive && p.role.team !== 'WEREWOLF');
                const row = new ActionRowBuilder();

                if (aliveVillagers.length > 0) {
                    const { StringSelectMenuBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('lg_wolf_vote')
                        .setPlaceholder('Choisir une victime')
                        .addOptions(aliveVillagers.map(v => ({
                            label: v.username,
                            value: v.id
                        })));
                    row.addComponents(select);
                    await this.wolfThread.send({ content: "Votez pour la personne à éliminer :", components: [row] });
                }

            } catch (e) {
                console.log("Cannot create private thread, creating public thread for wolves (fallback).");
                if (!this.wolfThread) {
                    this.wolfThread = await this.channel.threads.create({
                        name: '🐺 Les Loups (Public Fallback)',
                        autoArchiveDuration: 60
                    });
                    await this.wolfThread.send(`⚠️ Impossible de créer un fil privé. Ce fil est public, attention !`);
                }
            }
        }

        // Reset night actions
        this.nightActions.wolfVotes.clear();
        this.nightActions.seerTargetId = null;
        this.nightActions.witchAction = null;
        this.nightActions.whiteWolfTargetId = null;
        this.nightActions.blackWolfInfectedId = null;
        this.nightActions.pyroGasTargetIds = [];
        this.nightActions.pyroAction = null;

        // Start timer for the night (Wolfy style)
        const timerSecs = await this.getRoundTimer();
        const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

        const nightEmbed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`🌃 Nuit ${this.turn}`)
            .setDescription(`Le village s'endort...\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setFooter({ text: 'Les rôles spéciaux prennent leurs décisions...' });

        this.nightMessage = await this.thread.send({ embeds: [nightEmbed] });

        // Call Role.onNight() for everyone (hooks)
        for (const player of this.players.values()) {
            if (player.isAlive && player.role) {
                // On passe le thread privé s'il existe
                const thread = this.playerThreads.get(player.id);
                const msg = await player.role.onNight(this, player, unixTimestamp, thread);
                if (msg) this.roleActionMessages.set(player.id, msg);
            }
        }

        this.startTimer(timerSecs, async () => {
            await this.handleNightResult();
        });
    }

    async checkNightEnd() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const wolvesCount = alivePlayers.filter(p => p.role.team === 'WEREWOLF').length;
        const wolvesVoted = this.nightActions.wolfVotes.size;

        const hasSeer = alivePlayers.some(p => p.role.id === 'seer');
        const seerVoted = !!this.nightActions.seerTargetId;

        const hasWitch = alivePlayers.some(p => p.role.id === 'witch');
        const witchVoted = !!this.nightActions.witchAction;

        const hasGuard = alivePlayers.some(p => p.role.id === 'guard');
        const guardVoted = !!this.nightActions.guardTargetId;

        const hasCupid = alivePlayers.some(p => p.role.id === 'cupid');
        const cupidVoted = this.nightActions.cupidTargets.length === 2;

        const hasWhiteWolf = alivePlayers.some(p => p.role.id === 'white_werewolf');
        const whiteWolfVoted = (this.turn % 2 !== 0) || !!this.nightActions.whiteWolfTargetId;

        const hasCrow = alivePlayers.some(p => p.role.id === 'crow');
        const crowVoted = !!this.nightActions.crowTargetId;

        const hasHeir = alivePlayers.some(p => p.role.id === 'heir');
        const heirVoted = (this.turn !== 1) || !!alivePlayers.find(p => p.role.id === 'heir')?.role?.targetId;

        const hasBlackWolf = alivePlayers.some(p => p.role.id === 'black_werewolf' && p.role.hasInfectionPower);
        const blackWolfVoted = !hasBlackWolf || !this.nightActions.wolfTargetId || !!this.nightActions.blackWolfInfectedId;

        const hasPyro = alivePlayers.some(p => p.role.id === 'pyromaniac');
        const pyroVoted = !!this.nightActions.pyroAction;

        const hasWildChild = alivePlayers.some(p => p.role.id === 'wild_child');
        const wildChildVoted = (this.turn !== 1) || !!alivePlayers.find(p => p.role.id === 'wild_child')?.role?.modelId;

        // On vérifie si tout le monde a agi
        let allReady = (wolvesVoted >= wolvesCount);
        if (hasSeer && !seerVoted) allReady = false;
        if (hasWitch && !witchVoted) allReady = false;
        if (hasGuard && !guardVoted) allReady = false;
        if (this.turn === 1 && hasCupid && !cupidVoted) allReady = false;
        if (this.turn % 2 === 0 && hasWhiteWolf && !whiteWolfVoted) allReady = false;
        if (hasCrow && !crowVoted) allReady = false;
        if (this.turn === 1 && hasHeir && !heirVoted) allReady = false;
        if (hasBlackWolf && !blackWolfVoted) allReady = false;
        if (hasPyro && !pyroVoted) allReady = false;
        if (this.turn === 1 && hasWildChild && !wildChildVoted) allReady = false;

        if (allReady) {
            await this.handleNightResult();
        }
    }

    async handleNightResult() {
        if (this.state !== 'NIGHT') return;
        try {
            this.clearTimers();
            this.state = 'DAY';

            // Clean active action messages
            this.roleActionMessages.clear();

            // 1. Calculer la victime des loups
            let victimId = null;
            let isUnanimous = false;
            if (this.nightActions.wolfVotes.size > 0) {
                const counts = {};
                for (const targetId of this.nightActions.wolfVotes.values()) {
                    counts[targetId] = (counts[targetId] || 0) + 1;
                }
                victimId = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

                const wolfCount = Array.from(this.players.values()).filter(p => p.role.team === 'WEREWOLF' && p.isAlive).length;
                if (counts[victimId] === wolfCount) isUnanimous = true;
            }
            this.isWolfUnanimous = isUnanimous;
            this.nightActions.wolfTargetId = victimId;

            // Loup Noir : Infection
            const blackWolf = Array.from(this.players.values()).find(p => p.role.id === 'black_werewolf' && p.isAlive && p.role.hasInfectionPower);
            if (blackWolf && victimId) {
                const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
                const target = this.players.get(victimId);
                const unixTimestamp = Math.floor((Date.now() + 30000) / 1000); // 30s pour l'infection

                const embed = new EmbedBuilder()
                    .setTitle('🖤 Infection du Loup Noir')
                    .setDescription(`La victime des loups est <@${victimId}>. Voulez-vous utiliser votre pouvoir unique pour le transformer en loup ?\n\n⏱️ **Fin de la décision :** <t:${unixTimestamp}:R>`)
                    .setColor('#000000');

                const select = new StringSelectMenuBuilder()
                    .setCustomId('lg_black_wolf_infection')
                    .setPlaceholder('Infecter ?')
                    .addOptions([
                        { label: 'Infecter la cible (Devient Loup)', value: victimId, emoji: '💉' },
                        { label: 'Ne rien faire', value: 'skip', emoji: '❌' }
                    ]);

                const row = new ActionRowBuilder().addComponents(select);

                // Send to private thread
                const thread = this.playerThreads.get(blackWolf.id);
                if (thread) {
                    await thread.send({ content: `<@${blackWolf.id}>`, embeds: [embed], components: [row] });
                }
            }
            // Note: checkNightEnd needs to wait for black wolf if he decides to infect.
            // But usually infection happens in a special turn. 
            // We'll handle it by adding a check in handleNightResult.


            // 2. Traitement Infection Loup Noir
            if (this.nightActions.blackWolfInfectedId && this.nightActions.blackWolfInfectedId !== 'skip' && victimId === this.nightActions.blackWolfInfectedId) {
                const victim = this.players.get(this.nightActions.blackWolfInfectedId);
                victim.role.team = 'WEREWOLF';
                victim.isInfected = true;
                victimId = null; // Il ne meurt plus, il est infecté

                // Message au nouveau loup
                try {
                    const victimThread = this.playerThreads.get(victim.id);
                    if (victimThread) {
                        await victimThread.send("🖤 **Tu as été infecté !** Tu es désormais un Loup-Garou et tu gagnes avec eux.");
                    }
                } catch (e) {
                    console.error(`[ERROR] Failed to send infection notification to ${victim.id}:`, e.message);
                }

                // Update Black Wolf power
                const blackWolf = Array.from(this.players.values()).find(p => p.role.id === 'black_werewolf');
                if (blackWolf) blackWolf.role.hasInfectionPower = false;

                this.logEvent(`Le Loup Noir a infecté **${victim.username}**.`);
                await this.thread.send("🖤 Une ombre maléfique s'est répandue cette nuit...");
            }

            // 3. Traitement Loup Blanc
            if (this.nightActions.whiteWolfTargetId && this.nightActions.whiteWolfTargetId !== 'skip') {
                const wwTarget = this.players.get(this.nightActions.whiteWolfTargetId);
                this.logEvent(`Le Loup Blanc a dévoré **${wwTarget?.username}**.`);
                await this.applyDeath(this.nightActions.whiteWolfTargetId);
            }

            // 4. Traitement Pyromane
            if (this.nightActions.pyroAction === 'BURN') {
                const pyro = Array.from(this.players.values()).find(p => p.role.id === 'pyromaniac');
                if (pyro) {
                    this.logEvent(`Le Pyromane a déclenché l'incendie !`);
                    for (const targetId of pyro.role.gassedIds) {
                        await this.applyDeath(targetId);
                    }
                    pyro.role.gassedIds.clear();
                    await this.thread.send("🔥 **L'incendie s'est déclaré !** Tous les joueurs gazés ont péri dans les flammes.");
                }
            } else if (this.nightActions.pyroAction === 'GAS') {
                const pyro = Array.from(this.players.values()).find(p => p.role.id === 'pyromaniac');
                if (pyro) {
                    this.logEvent(`Le Pyromane a gazé de nouvelles victimes.`);
                    for (const targetId of this.nightActions.pyroGasTargetIds) {
                        pyro.role.gassedIds.add(targetId);
                    }
                }
            }

            // 5. Vérifier Protection du Garde / Ancien
            if (victimId) {
                const victimPlayer = this.players.get(victimId);
                if (this.nightActions.guardTargetId === victimId) {
                    this.logEvent(`Le Garde a protégé la cible des loups (**${victimPlayer.username}**).`);
                    victimId = null; // Sauvé par le garde
                } else if (victimPlayer && victimPlayer.role.id === 'elder' && victimPlayer.role.extraLife) {
                    victimPlayer.role.extraLife = false;
                    this.logEvent(`L'Ancien a survécu à l'attaque des loups.`);
                    await this.thread.send(`👴 L'Ancien a survécu à une attaque fatale cette nuit !`);
                    victimId = null;
                }
            }

            // 3. Traitement Sorcière
            if (this.nightActions.witchAction) {
                if (this.nightActions.witchAction.type === 'SAVE' && this.nightActions.witchAction.targetId === victimId) {
                    victimId = null;
                } else if (this.nightActions.witchAction.type === 'KILL' && this.nightActions.witchAction.targetId) {
                    await this.applyDeath(this.nightActions.witchAction.targetId);
                }
            }

            // 4. Appliquer la mort de la victime des loups
            if (victimId) {
                await this.applyDeath(victimId);
            }

            // 5. Liaison Cupid (Nuit 1)
            if (this.turn === 1 && this.nightActions.cupidTargets.length === 2) {
                const p1 = this.players.get(this.nightActions.cupidTargets[0]);
                const p2 = this.players.get(this.nightActions.cupidTargets[1]);
                if (p1 && p2) {
                    p1.lover = p2.id;
                    p2.lover = p1.id;
                    try {
                        const t1 = this.playerThreads.get(p1.id);
                        const t2 = this.playerThreads.get(p2.id);
                        if (t1) await t1.send(`💘 Tu es amoureux de **${p2.username}** ! Si l'un meurt, l'autre aussi.`);
                        if (t2) await t2.send(`💘 Tu es amoureux de **${p1.username}** ! Si l'un meurt, l'autre aussi.`);
                    } catch (e) {
                        console.error(`[ERROR] Failed to send Lovers notification:`, e.message);
                    }
                }
            }

            await this.thread.send(`🌅 **Le soleil se lève sur le village...**`);

            const alivePlayersEnd = Array.from(this.players.values());
            const deadThisNight = alivePlayersEnd.filter(p => p.justDied);

            if (deadThisNight.length > 0) {
                for (const p of deadThisNight) {
                    await this.thread.send(`💀 <@${p.id}> a été retrouvé sans vie. Il était **${p.role.name}**.`);
                    p.justDied = false;
                    this.lastDead = p; // Sauvegarde pour le Fossoyeur
                }
            } else {
                await this.thread.send(`🙏 Miracle ! Personne n'est mort cette nuit.`);
            }

            if (!(await this.checkWinCondition())) {
                const timerSecs = await this.getRoundTimer();
                const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

                // Dictateur : Hook Day
                for (const p of this.players.values()) {
                    if (p.isAlive && p.role.onDay) await p.role.onDay(this, p, unixTimestamp);
                }
            }

            if (await this.checkWinCondition()) return;

            // Élection du Maire le premier matin
            if (this.turn === 1 && !this.mayorId) {
                await this.startMayorElection();
            } else {
                await this.startDay();
            }
        } catch (error) {
            console.error("CRITICAL ERROR in handleNightResult:", error);
            if (this.state === 'DAY') await this.startDay().catch(e => console.error("Recovery failed:", e));
        }
    }

    async startMayorElection() {
        this.state = 'MAYOR_ELECTION';
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

        const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
        const unixTimestamp = Math.floor((Date.now() + 30000) / 1000);
        const embed = new EmbedBuilder()
            .setTitle('🗳️ Élection du Maire')
            .setDescription(`Le village a besoin d'un chef ! Qui voulez-vous élire comme Maire ?\n*(Le Maire a un vote qui compte double en cas d'égalité)*\n\n⏱️ **Fin de l'élection :** <t:${unixTimestamp}:R>`)
            .setColor('#3498db');

        const select = new StringSelectMenuBuilder()
            .setCustomId('lg_mayor_vote')
            .setPlaceholder('Voter pour un candidat')
            .addOptions(alivePlayers.map(p => ({
                label: p.username,
                value: p.id
            })));

        const row = new ActionRowBuilder().addComponents(select);
        this.votingMessage = await this.thread.send({ embeds: [embed], components: [row] });

        this.startTimer(30, async () => {
            await this.handleMayorResult();
        });
    }

    async handleMayorResult() {
        if (this.state !== 'MAYOR_ELECTION') return;
        this.clearTimers();

        const counts = {};
        const voteDetails = [];

        for (const player of this.players.values()) {
            if (player.isAlive && player.mayorVote) {
                counts[player.mayorVote] = (counts[player.mayorVote] || 0) + 1;

                const candidate = this.players.get(player.mayorVote);
                voteDetails.push(`🗳️ **${player.username}** ➔ **${candidate.username}**`);

                player.mayorVote = null;
            }
        }

        if (voteDetails.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🗳️ Résultat de l\'Élection')
                .setDescription(voteDetails.join('\n'))
                .setColor('#3498db');
            await this.thread.send({ embeds: [embed] });
        }

        let winnerId = null;
        if (Object.keys(counts).length > 0) {
            winnerId = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        } else {
            // Si personne n'a voté, on prend l'hôte ou un joueur au hasard
            winnerId = Array.from(this.players.values()).find(p => p.isAlive).id;
        }

        this.mayorId = winnerId;
        const winner = this.players.get(winnerId);
        this.logEvent(`**${winner.username}** a été élu Maire.`);
        await this.thread.send(`🎖️ **Félicitations à <@${winnerId}>, élu Maire du village !**`);

        await this.startDay();
    }

    async applyDeath(userId) {
        const player = this.players.get(userId);
        if (!player || !player.isAlive) return;

        player.isAlive = false;
        player.justDied = true;
        this.logEvent(`**${player.username}** (${player.role.name}) est mort.`);

        // Heir logic
        for (const p of this.players.values()) {
            if (p.isAlive && p.role.id === 'heir' && p.role.targetId === player.id) {
                p.assignRole(player.role);
                this.logEvent(`L'Héritier (**${p.username}**) a récupéré le rôle de **${player.role.name}**.`);
                try {
                    const heirThread = this.playerThreads.get(p.id);
                    if (heirThread) {
                        await heirThread.send(`📜 Ton protecteur est mort. Tu hérites de son rôle : **${p.role.name}** !`);
                    }
                } catch (e) {
                    console.error(`[ERROR] Failed to send Heir notification to ${p.id}:`, e.message);
                }
                break;
            }
        }

        // Wild Child logic
        for (const p of this.players.values()) {
            if (p.isAlive && p.role.id === 'wild_child' && p.role.modelId === player.id) {
                p.role.team = 'WEREWOLF';
                this.logEvent(`L'Enfant Sauvage (**${p.username}**) est devenu un Loup.`);
                try {
                    const wildThread = this.playerThreads.get(p.id);
                    if (wildThread) {
                        await wildThread.send("🏹 **Ton modèle est mort.** La haine t'envahit... Tu es désormais un Loup-Garou !");
                    }
                } catch (e) {
                    console.error(`[ERROR] Failed to send Wild Child notification to ${p.id}:`, e.message);
                }
                await this.thread.send("🏹 L'Enfant Sauvage a perdu son guide et a rejoint les loups...");
            }
        }

        // Hunter logic
        if (player.role && player.role.id === 'hunter') {
            const unixTimestamp = this.timerEnd ? Math.floor(this.timerEnd / 1000) : null;
            await player.role.onDeath(this, player, unixTimestamp);
        }

        // Lover logic
        if (player.lover) {
            const otherLover = this.players.get(player.lover);
            if (otherLover && otherLover.isAlive) {
                this.logEvent(`**${otherLover.username}** s'est suicidé par amour.`);
                await this.thread.send(`💘 Sous le choc de la perte de son amour, <@${otherLover.id}> se donne la mort.`);
                await this.applyDeath(otherLover.id);
            }
        }
    }

    async startDay() {
        if (this.state === 'END') return; // Loop Safety
        this.state = 'DAY_VOTING';
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

        // Reset votes for the new day
        for (const player of this.players.values()) {
            player.voteTarget = null;
        }

        const timerSecs = await this.getRoundTimer();
        const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

        if (this.hasDictatorTakenOver) {
            const dictator = alivePlayers.find(p => p.role.id === 'dictator');
            await this.thread.send(`👑 **DICTATURE !** Seul <@${dictator.id}> a le droit de vote aujourd'hui. Tout le village l'écoute...`);

            const embed = new EmbedBuilder()
                .setTitle('👑 Décision du Dictateur')
                .setDescription(`Le village attend votre sentence, <@${dictator.id}>.\n\n⏱️ **Fin de la dictature :** <t:${unixTimestamp}:R>`)
                .setColor('#f1c40f');

            // ... (rest of search/select code)
            const { StringSelectMenuBuilder } = require('discord.js');
            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_dictator_vote')
                .setPlaceholder('Choisir qui éliminer')
                .addOptions(alivePlayers.filter(p => p.id !== dictator.id).map(p => ({
                    label: p.username,
                    value: p.id
                })));

            const row = new ActionRowBuilder().addComponents(select);
            this.votingMessage = await this.thread.send({ content: `<@${dictator.id}>`, embeds: [embed], components: [row] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('⚖️ Le Conseil du Village')
                .setDescription(`Il est temps de débattre et de voter contre un suspect !\n\n⏱️ **Fin des votes :** <t:${unixTimestamp}:R>`)
                .setColor('#f1c40f');

            // ... (rest of search/select code)
            const { StringSelectMenuBuilder } = require('discord.js');
            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_village_vote')
                .setPlaceholder('Voter contre quelqu\'un')
                .addOptions(alivePlayers.map(p => ({
                    label: p.username,
                    value: p.id
                })));

            const row = new ActionRowBuilder().addComponents(select);
            this.votingMessage = await this.thread.send({ embeds: [embed], components: [row] });
        }

        this.startTimer(timerSecs, async () => {
            await this.handleVillageVoteResult();
        });
    }

    async getRoundTimer() {
        const { db } = require('../../services/firebase');
        const config = await db.collection('guilds').doc(this.channel.guildId).collection('config').doc('werewolf').get();
        return (config.exists && config.data().timer) || 60;
    }

    async startTimer(seconds, callback) {
        if (this.timer) clearTimeout(this.timer);
        if (this.timerUpdate) clearInterval(this.timerUpdate);

        this.timerEnd = Date.now() + (seconds * 1000);

        this.timer = setTimeout(async () => {
            this.clearTimers();
            await callback();
        }, seconds * 1000);
    }

    clearTimers() {
        if (this.timer) clearTimeout(this.timer);
        if (this.timerUpdate) clearInterval(this.timerUpdate);
    }

    async checkWinCondition() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const wolves = alivePlayers.filter(p => p.role.team === 'WEREWOLF');
        const villagers = alivePlayers.filter(p => p.role.team === 'VILLAGE');
        const whiteWolf = alivePlayers.find(p => p.role.id === 'white_werewolf');
        const pyro = alivePlayers.find(p => p.role.id === 'pyromaniac');

        let winningTeam = null;

        // 1. Victoire du Couple (Priorité)
        if (alivePlayers.length === 2) {
            const p1 = alivePlayers[0];
            const p2 = alivePlayers[1];
            if (p1.lover === p2.id) {
                winningTeam = 'lovers';
                await this.thread.send('💘 **VICTOIRE DU COUPLE !** L\'amour a triomphé du chaos.');
                const journalEmbed = await this.generateJournal('Victoire du Couple 💖');
                await this.thread.send({ embeds: [journalEmbed] });
            }
        }

        // 2. Victoire du Pyromane
        if (!winningTeam && pyro && alivePlayers.length <= 2 && !whiteWolf && wolves.length === 0) {
            winningTeam = 'pyromaniac';
            await this.thread.send('🔥 **VICTOIRE DU PYROMANE !** Il a réduit le village en cendres et rit seul au milieu des ruines.');
            const journalEmbed = await this.generateJournal('Victoire du Pyromane');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 3. Victoire du Loup Blanc
        if (!winningTeam && whiteWolf && alivePlayers.length <= 2 && wolves.length === 0) {
            winningTeam = 'white_werewolf';
            await this.thread.send('⚪ **VICTOIRE DU LOUP BLANC !** Il a dévoré tout le monde, même ses semblables.');
            const journalEmbed = await this.generateJournal('Victoire du Loup Blanc');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 4. Victoire du Village
        if (!winningTeam && wolves.length === 0 && !whiteWolf && !pyro) {
            winningTeam = 'village';
            await this.thread.send('🎉 **VICTOIRE DU VILLAGE !** Tous les loups et menaces ont été éliminés.');
            const journalEmbed = await this.generateJournal('Victoire du Village');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 5. Victoire des Loups
        if (!winningTeam && (wolves.length + (whiteWolf ? 1 : 0)) >= villagers.length && !pyro) {
            if (!whiteWolf || (whiteWolf && wolves.length > 0)) {
                winningTeam = 'werewolf';
                await this.thread.send('🐺 **VICTOIRE DES LOUPS-GAROUS !** Ils ont dévoré tout le village.');
                const journalEmbed = await this.generateJournal('Victoire des Loups');
                await this.thread.send({ embeds: [journalEmbed] });
            }
        }

        // Si une équipe a gagné, enregistrer les statistiques
        if (winningTeam) {
            await this.recordGameStats(winningTeam);
            this.manager.endGame(this.channel.id);
            this.cleanupThreads(60000);
            return true;
        }

        return false;
    }

    /**
     * Enregistre les statistiques de la partie
     */
    async recordGameStats(winningTeam) {
        try {
            const playersData = Array.from(this.players.values()).map(p => ({
                id: p.id,
                username: p.username,
                role: p.role,
                team: p.role.team,
                isAlive: p.isAlive,
                lover: p.lover
            }));

            const gameData = {
                wasMayor: this.mayorId ? [this.mayorId] : []
            };

            await recordWerewolfGame(
                this.channel.guildId,
                playersData,
                winningTeam,
                gameData
            );

            console.log(`[Werewolf] Stats enregistrées - Vainqueur: ${winningTeam}`);
        } catch (error) {
            console.error('[Werewolf] Erreur enregistrement stats:', error);
        }
    }

    async handleVillageVoteResult() {
        if (this.state !== 'DAY_VOTING') return;
        this.clearTimers();

        const counts = {};
        for (const player of this.players.values()) {
            if (player.isAlive && player.voteTarget) {
                counts[player.voteTarget] = (counts[player.voteTarget] || 0) + 1;
            }
        }

        let victimId = null;
        if (this.hasDictatorTakenOver) {
            const dictator = Array.from(this.players.values()).find(p => p.role.id === 'dictator' && p.isAlive);
            victimId = dictator?.voteTarget;
            this.hasDictatorTakenOver = false; // Reset power for next turn (if he had it)
        } else if (Object.keys(counts).length > 0) {
            const maxVotes = Math.max(...Object.values(counts));
            const tied = Object.keys(counts).filter(id => counts[id] === maxVotes);

            if (tied.length === 1) {
                victimId = tied[0];
            } else if (this.mayorId && this.players.get(this.mayorId).isAlive) {
                const mayor = this.players.get(this.mayorId);
                const mayorTarget = mayor.voteTarget;
                if (tied.includes(mayorTarget)) {
                    victimId = mayorTarget;
                    await this.thread.send(`⚖️ Égalité ! Le Maire <@${this.mayorId}> tranche en faveur de l'élimination de <@${victimId}>.`);
                }
            }
        }

        this.nightActions.crowTargetId = null; // Reset

        if (!victimId) {
            await this.thread.send("⚖️ Le village n'a pas réussi à se mettre d'accord. Personne n'est éliminé.");
        } else {
            const victim = this.players.get(victimId);
            await this.thread.send(`⚖️ ${victim.role.id === 'dictator' ? "" : (this.hasDictatorTakenOver ? "**Par décret dictatorial** " : "Le village a décidé ")}d'éliminer <@${victim.id}>. Il était **${victim.role.name}**.`);

            // Elder logic
            if (victim.role.id === 'elder') {
                await this.thread.send("😱 **SACRILÈGE !** L'Ancien a été tué par le village. Tous les villageois perdent leurs pouvoirs !");
                for (const p of this.players.values()) {
                    if (p.role.team === 'VILLAGE') p.powerless = true;
                }
            }

            await this.applyDeath(victimId);
            this.lastDead = victim;
        }

        if (!(await this.checkWinCondition())) {
            await this.startNight();
        }
    }

    async generateJournal(title) {
        // S'assurer que tous les joueurs sont en cache pour les mentions
        await cachePlayersForMentions(this.channel.guild, Array.from(this.players.values()));

        const embed = new EmbedBuilder()
            .setTitle(`📜 Journal : ${title}`)
            .setDescription(this.logs.join('\n') || "Aucun événement notable.")
            .setColor('#7f8c8d')
            .setTimestamp();

        // Reveal all roles - Utiliser les mentions Discord @
        let revelation = "";
        for (const p of this.players.values()) {
            let status = `${p.isAlive ? '✅' : '💀'} <@${p.id}> : **${p.role.name}**`;
            if (p.lover) {
                const lover = this.players.get(p.lover);
                status += ` 💘 (Amoureux de <@${lover?.id}>)`;
            }
            revelation += status + '\n';
        }
        embed.addFields({ name: '🎭 Révélation des rôles', value: revelation });

        return embed;
    }

}

module.exports = Game;
