const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, AttachmentBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const Player = require('./Player');
const path = require('path');
const fs = require('fs');
const { recordWerewolfGame } = require('../gameStats');
const { cachePlayersForMentions } = require('../../utils/mentions');

const THEMES = {
    default: { color: '#2b2d31', thumbnail: 'https://cdn-icons-png.flaticon.com/512/1993/1993290.png' },
    forest: { color: '#2ecc71', thumbnail: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' },
    dark: { color: '#1a1a1a', thumbnail: 'https://cdn-icons-png.flaticon.com/512/3094/3094936.png' },
    bloody: { color: '#c0392b', thumbnail: 'https://cdn-icons-png.flaticon.com/512/10312/10312563.png' }
};

class Game {
    constructor(client, channel, host, manager, theme = 'default') {
        this.client = client;
        this.channel = channel;
        this.host = host;
        this.manager = manager;
        this.themeId = theme;
        this.theme = THEMES[theme] || THEMES.default;

        this.players = new Map(); // UserID -> Player
        this.playerThreads = new Map(); // UserID -> ThreadChannel (Universal Threads)
        this.state = 'LOBBY'; // LOBBY, NIGHT, DAY, VOTING, END
        this.thread = null; // Thread principal du jeu
        this.wolfThread = null; // Thread privé des loups
        this.nightActions = {
            wolfVotes: new Map(), // VoterID -> TargetID
            wolfTargetId: null,
            seerTargetId: null,
            witchActions: { save: null, kill: null, skip: false },
            guardTargetId: null,
            cupidTargets: [], // [id1, id2]
            whiteWolfTargetId: null,
            crowTargetId: null,
            blackWolfInfectedId: null,
            pyroGasTargetIds: [],
            pyroAction: null, // 'GAS' or 'BURN'
        };
        this.isWolfUnanimous = false;
        this.turn = 1; // Tour actuel
        this.mayorId = null; // ID du Maire élu
        this.logs = []; // Journal des événements
        this.recentDeadIds = []; // Liste des IDs des morts du cycle en cours (pour le Fossoyeur)
        this.customRoles = []; // Liste des IDs de rôles choisis manuellement
        this.roleActionMessages = new Map(); // UserID -> Message (Active action prompt)
        this.pendingHunter = false; // Pause le jeu en attendant le tir du Chasseur
        this.dayPending = false; // File d'attente pour startDay si bloqué par Chasseur
        this.hunterTimer = null; // Timer spécifique pour le Chasseur (indépendant du timer global)

        // DB Ref for persistence
        this.dbRef = db.collection('werewolf_active_games').doc(this.channel.id);
    }

    async saveState() {
        try {
            const playersData = Array.from(this.players.values()).map(p => ({
                id: p.id,
                username: p.username,
                roleId: p.role?.id || null,
                isAlive: p.isAlive,
                isProtected: p.isProtected,
                isInfected: p.isInfected,
                isLover: p.isLover,
                isMayor: p.isMayor
            }));

            await this.dbRef.set({
                guildId: this.channel.guild.id,
                channelId: this.channel.id,
                hostId: this.host.id,
                state: this.state,
                phase: this.phase,
                turn: this.turn,
                themeId: this.themeId,
                threadId: this.thread?.id || null,
                wolfThreadId: this.wolfThread?.id || null,
                players: playersData,
                lastUpdate: new Date()
            }, { merge: true });
        } catch (err) {
            console.error(`[Werewolf] Error saving state for ${this.channel.id}:`, err);
        }
    }

    setTheme(themeId) {
        if (THEMES[themeId]) {
            this.themeId = themeId;
            this.theme = THEMES[themeId];
            return true;
        }
        return false;
    }

    async deleteState() {
        try {
            await this.dbRef.delete();
        } catch (err) {
            console.error(`[Werewolf] Error deleting state for ${this.channel.id}:`, err);
        }
    }

    logEvent(message) {
        this.logs.push(`• ${message}`);
    }

    async startLobby() {
        const embed = new EmbedBuilder()
            .setColor(this.theme.color)
            .setTitle('🐺 Loup-Garou - Nouvelle Partie')
            .setDescription(`Le Maire **${this.host.username}** recrute des villageois !\n\n**Joueurs (1/25) :**\n${this.host} (Hôte)`)
            .setThumbnail(this.theme.thumbnail);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lg_join').setLabel('Rejoindre').setStyle(ButtonStyle.Success).setEmoji('✋'),
            new ButtonBuilder().setCustomId('lg_leave').setLabel('Quitter').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('lg_start').setLabel('Lancer').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
            new ButtonBuilder().setCustomId('lg_stop').setLabel('Arrêter').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lg_config_composition').setLabel('Composition').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('lg_config_theme').setLabel('Thème').setStyle(ButtonStyle.Secondary).setEmoji('🎨')
        );

        this.addPlayer(this.host);

        this.lobbyMessage = await this.channel.send({ embeds: [embed], components: [row, row2] });
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

    async addPlayer(user) {
        if (this.players.has(user.id)) return false;
        if (this.players.size >= 25) return false;
        this.players.set(user.id, new Player(user));
        this.manager.joinGame(user.id, this.channel.id);
        await this.saveState();
        return true;
    }

    async removePlayer(userId) {
        if (this.state !== 'LOBBY') return false; // Impossible de quitter une fois le jeu lancé
        if (!this.players.has(userId)) return false;
        this.players.delete(userId);
        this.manager.leaveGame(userId);
        await this.saveState();
        return true;
    }

    async updateLobby() {
        if (!this.lobbyMessage) return;

        // On utilise Nom + Mention pour être sûr que ça s'affiche bien (Double Sécurité @ID)
        const playerList = Array.from(this.players.values())
            .map((p, i) => `**${i + 1}.** ${p.username} (<@${p.id}>)`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(this.theme.color)
            .setTitle('🐺 Loup-Garou - Recrutement')
            .setDescription(`Le Maire **${this.host.username}** recrute des villageois !\n\n**Joueurs (${this.players.size}/25) :**\n${playerList || "_Aucun joueur_"}`)
            .setThumbnail(this.theme.thumbnail);

        await this.lobbyMessage.edit({ embeds: [embed] });
    }

    async start() {
        if (this.players.size < 4) {
            return this.channel.send("❌ Pas assez de joueurs pour commencer (Min: 4).");
        }

        this.state = 'STARTING';
        if (this.lobbyMessage) await this.lobbyMessage.delete().catch(() => { });
        this.channel.send("🎲 **Lancement de la partie... Distribution des rôles en cours !**");

        // 1. Cache all players for proper mention resolution IMMEDIATELY
        await cachePlayersForMentions(this.channel.guild, Array.from(this.players.values()));

        // 2. Create Game Thread
        try {
            this.thread = await this.channel.threads.create({
                name: `Loup-Garou - Partie de ${this.host.username}`,
                autoArchiveDuration: 60,
                reason: 'Partie de Loup-Garou'
            });
            const playerMentions = Array.from(this.players.values()).map(p => `<@${p.id}>`).join(', ');
            await this.thread.send(`📢 **La partie commence !** Bienvenue à : ${playerMentions}`);
        } catch (e) {
            console.error("Error creating thread:", e);
            return this.channel.send("❌ Impossible de créer le fil de discussion. Vérifiez mes permissions !");
        }

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
        const wolves = Array.from(this.players.values()).filter(p => p.isAlive && (p.role.team === 'WEREWOLF' || p.role.id === 'white_werewolf'));
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
        this.nightActions.witchActions = { save: null, kill: null, skip: false };
        this.nightActions.whiteWolfTargetId = null;
        this.nightActions.blackWolfInfectedId = null;
        this.nightActions.pyroGasTargetIds = [];
        this.nightActions.pyroAction = null;

        // On ne vide PAS recentDeadIds ici, car le Fossoyeur doit voir les morts du JOUR précédent (Vote + Chasseur)
        // Le Fossoyeur agit la nuit et voit les morts de la "veille" (donc du cycle Jour qui vient de finir)

        // Start timer for the night (Wolfy style)
        const timerSecs = await this.getRoundTimer();
        const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

        const nightEmbed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`🌃 Nuit ${this.turn}`)
            .setDescription(`Le village s'endort...\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setFooter({ text: 'Les rôles spéciaux prennent leurs décisions...' });

        this.nightMessage = await this.thread.send({ embeds: [nightEmbed] });

        // Sécurité AFK : Si la nuit dure trop longtemps (ex: Pyro AFK), on force la résolution
        this.startTimer(timerSecs + 10, async () => {
            if (this.state === 'NIGHT') {
                console.log(`[Werewolf] Night timeout in ${this.channel.id}. Forcing resolution.`);
                await this.handleNightResult();
            }
        });

        // Call Role.onNight() for everyone (hooks)
        for (const player of this.players.values()) {
            if (player.isAlive && player.role) {
                // On passe le thread privé s'il existe
                const thread = this.playerThreads.get(player.id);

                if (player.powerless) {
                    if (thread) await thread.send("🔇 **Tu as perdu tes pouvoirs.** (L'Ancien a été tué par le village)");
                    continue;
                }

                const msg = await player.role.onNight(this, player, unixTimestamp, thread);
                if (msg) this.roleActionMessages.set(player.id, msg);
            }
        }

        this.startTimer(timerSecs, async () => {
            await this.handleNightResult();
        });
    }

    async checkNightEnd() {
        if (this.state === 'NIGHT_RESOLUTION') {
            const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
            const witch = alivePlayers.find(p => p.role.id === 'witch');
            const hasWitch = !!witch;
            const hasBlackWolf = alivePlayers.some(p => p.role.id === 'black_werewolf' && p.role.hasInfectionPower);

            const witchNeedsToAct = hasWitch && !witch.powerless && (witch.role.hasLifePotion || witch.role.hasDeathPotion);
            const witchVoted = !witchNeedsToAct || this.nightActions.witchActions.skip || (
                (witch.role.hasLifePotion ? (this.nightActions.witchActions.save || this.nightActions.witchActions.skip) : true) &&
                (witch.role.hasDeathPotion ? (this.nightActions.witchActions.kill || this.nightActions.witchActions.skip) : true)
            );
            const blackWolfVoted = !hasBlackWolf || !this.nightActions.wolfTargetId || this.nightActions.blackWolfInfectedId;

            if (witchVoted && blackWolfVoted) {
                await this.finalizeNight();
            }
            return;
        }

        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const wolvesCount = alivePlayers.filter(p => p.role.team === 'WEREWOLF').length;
        const wolvesVoted = this.nightActions.wolfVotes.size;

        const hasSeer = alivePlayers.some(p => p.role.id === 'seer');
        const seerVoted = !!this.nightActions.seerTargetId;

        const hasWitch = alivePlayers.some(p => p.role.id === 'witch');
        const witchVoted = hasWitch && (this.nightActions.witchActions.save || this.nightActions.witchActions.kill || this.nightActions.witchActions.skip);

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

        const hasPyro = alivePlayers.some(p => p.role.id === 'pyromaniac');
        const pyroVoted = !!this.nightActions.pyroAction;

        const hasWildChild = alivePlayers.some(p => p.role.id === 'wild_child');
        const wildChildVoted = (this.turn !== 1) || !!alivePlayers.find(p => p.role.id === 'wild_child')?.role?.modelId;

        // On vérifie si tout le monde a agi (sauf Sorcière et Loup Noir qui attendent le résultat des loups)
        let allReady = (wolvesVoted >= wolvesCount);
        if (hasSeer && !seerVoted) allReady = false;
        if (hasGuard && !guardVoted) allReady = false;
        if (this.turn === 1 && hasCupid && !cupidVoted) allReady = false;
        if (this.turn % 2 === 0 && hasWhiteWolf && !whiteWolfVoted) allReady = false;
        if (hasCrow && !crowVoted) allReady = false;
        if (this.turn === 1 && hasHeir && !heirVoted) allReady = false;
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
            this.state = 'NIGHT_RESOLUTION';

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

                const wolvesVoters = Array.from(this.players.values()).filter(p => p.isAlive && (p.role.team === 'WEREWOLF' || p.role.id === 'white_werewolf')).length;
                isUnanimous = (counts[victimId] === wolvesVoters);
            }
            this.isWolfUnanimous = isUnanimous;
            this.nightActions.wolfTargetId = victimId;

            // 2. Élection du Maire (Si Nuit 1)
            if (this.turn === 1 && !this.mayorId) {
                const mayorCounts = {};
                for (const player of this.players.values()) {
                    if (player.isAlive && player.mayorVote) {
                        mayorCounts[player.mayorVote] = (mayorCounts[player.mayorVote] || 0) + 1;
                    }
                }
                if (Object.keys(mayorCounts).length > 0) {
                    const electedId = Object.keys(mayorCounts).reduce((a, b) => mayorCounts[a] > mayorCounts[b] ? a : b);
                    this.mayorId = electedId;
                    this.logEvent(`**${this.players.get(this.mayorId).username}** a été élu Maire.`);
                } else {
                    const aliveIds = Array.from(this.players.keys()).filter(id => this.players.get(id).isAlive);
                    this.mayorId = aliveIds[Math.floor(Math.random() * aliveIds.length)];
                    this.logEvent(`Personne n'a voté pour le Maire. **${this.players.get(this.mayorId).username}** a été désigné d'office.`);
                }
            }

            // Déclencher les interactions de résolution (Sorcière, Loup Noir)
            const needsResolution = await this.triggerNightResolutionInteractions();

            if (!needsResolution) {
                await this.finalizeNight();
            } else {
                // On lance un timer court pour la résolution
                this.startTimer(30, async () => {
                    await this.finalizeNight();
                });
            }
        } catch (error) {
            console.error('Error in handleNightResult:', error);
            await this.finalizeNight();
        }
    }

    async triggerNightResolutionInteractions() {
        let count = 0;
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const victimId = this.nightActions.wolfTargetId;
        const unixTimestamp = Math.floor((Date.now() + 30000) / 1000);

        // 1. Sorcière
        const witch = alivePlayers.find(p => p.role.id === 'witch');
        if (witch && !witch.powerless) {
            const thread = this.playerThreads.get(witch.id);
            if (thread && (witch.role.hasLifePotion || witch.role.hasDeathPotion)) {
                this.nightActions.witchActions = { save: null, kill: null, skip: false }; // Reset for resolution phase
                await witch.role.onNight(this, witch, unixTimestamp, thread);
                count++;
            }
        }

        // 2. Loup Noir
        const blackWolf = alivePlayers.find(p => p.role.id === 'black_werewolf' && p.role.hasInfectionPower);
        if (blackWolf && victimId) {
            const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
            const target = this.players.get(victimId);

            const embed = new EmbedBuilder()
                .setTitle('🖤 Infection du Loup Noir')
                .setDescription(`La victime des loups est <@${victimId}> (${target.username}). Voulez-vous utiliser votre pouvoir unique pour le transformer en loup ?\n\n⏱️ **Fin de la décision :** <t:${unixTimestamp}:R>`)
                .setColor('#000000');

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_black_wolf_infection')
                .setPlaceholder('Infecter ?')
                .addOptions([
                    { label: 'Infecter la cible (Devient Loup)', value: victimId, emoji: '💉' },
                    { label: 'Ne rien faire', value: 'skip', emoji: '❌' }
                ]);

            const row = new ActionRowBuilder().addComponents(select);

            const thread = this.playerThreads.get(blackWolf.id);
            if (thread) {
                await thread.send({ content: `<@${blackWolf.id}>`, embeds: [embed], components: [row] });
                count++;
            }
        }

        // 3. Mentaliste
        const mentalist = alivePlayers.find(p => p.role.id === 'mentalist');
        if (mentalist && !mentalist.powerless) {
            const thread = this.playerThreads.get(mentalist.id);
            if (thread) {
                await mentalist.role.onNight(this, mentalist, unixTimestamp, thread);
                // Pas besoin d'incrémenter count car c'est une info passive
            }
        }

        return count > 0;
    }

    async finalizeNight() {
        if (this.state !== 'NIGHT_RESOLUTION') return;
        try {
            this.clearTimers();
            this.state = 'DAY';
            let victimId = this.nightActions.wolfTargetId;

            this.logEvent(`Phase de finalisation de la nuit. Victime initiale : ${victimId || 'Personne'}`);

            // 0. Liaison Cupidon (Doit être avant les morts pour le suicide)
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
                        if (t2) await t2.send(` Tu es amoureux de **${p1.username}** ! Si l'un meurt, l'autre aussi.`);
                    } catch (e) { }
                }
            }

            // 1. Protections (Garde / Sorcière)
            let isProtected = false;

            // Garde
            if (this.nightActions.guardTargetId && this.nightActions.guardTargetId === victimId) {
                isProtected = true;
                this.logEvent(`Victime protégée par le Garde.`);
            }

            // Sorcière (Vie) - Prioritaire sur l'infection
            if (this.nightActions.witchActions.save && this.nightActions.witchActions.save === victimId) {
                isProtected = true;
                this.logEvent(`Cible sauvée par la Sorcière.`);
            }

            // Si protégé, on annule la victimisation par les loups
            if (isProtected) {
                victimId = null;
            }

            // 2. Traitement Infection Loup Noir
            if (victimId && this.nightActions.blackWolfInfectedId && this.nightActions.blackWolfInfectedId !== 'skip' && victimId === this.nightActions.blackWolfInfectedId) {
                const victim = this.players.get(this.nightActions.blackWolfInfectedId);
                victim.role.team = 'WEREWOLF';
                victim.isInfected = true;

                // Annulation de la mort
                victimId = null;
                this.logEvent(`Le Loup Noir a infecté sa cible.`);

                try {
                    const victimThread = this.playerThreads.get(victim.id);
                    if (victimThread) {
                        await victimThread.send("🖤 **Tu as été infecté !** Une ombre t'a mordu sans te tuer... Tu es désormais un Loup-Garou et tu gagnes avec eux.");
                    }

                    // Ajout au thread des loups
                    if (this.wolfThread) {
                        await this.wolfThread.members.add(victim.id);
                        await this.wolfThread.send(`🖤 **Un nouveau membre rejoint la meute...** <@${victim.id}> a été infecté par le Loup Noir !`);
                    }
                } catch (e) {
                    console.error("Error processing infection:", e);
                }

                const blackWolf = Array.from(this.players.values()).find(p => p.role.id === 'black_werewolf');
                if (blackWolf) blackWolf.role.hasInfectionPower = false;
                await this.thread.send("🖤 Une ombre maléfique s'est répandue cette nuit...");
            }

            // 3. Traitement Loup Blanc
            if (this.nightActions.whiteWolfTargetId && this.nightActions.whiteWolfTargetId !== 'skip') {
                const target = this.players.get(this.nightActions.whiteWolfTargetId);

                // Vérification protection Garde
                let isWhiteWolfProtected = false;
                if (this.nightActions.guardTargetId && this.nightActions.guardTargetId === this.nightActions.whiteWolfTargetId) {
                    isWhiteWolfProtected = true;
                    this.logEvent(`Cible du Loup Blanc protégée par le Garde.`);
                }

                if (target && !isWhiteWolfProtected) {
                    if (target.role.id === 'elder' && target.role.extraLife) {
                        target.role.extraLife = false;
                        await this.thread.send(`👴 L'Ancien a survécu à une attaque fatale cette nuit !`);
                    } else {
                        await this.applyDeath(this.nightActions.whiteWolfTargetId, 'WHITE_WOLF');
                    }
                }
            }

            // 4. Traitement Pyromane
            if (this.nightActions.pyroAction === 'BURN') {
                const pyros = Array.from(this.players.values()).filter(p => p.role.id === 'pyromaniac');
                const burntIds = new Set();

                for (const pyro of pyros) {
                    for (const id of pyro.role.gassedIds) burntIds.add(id);
                    pyro.role.gassedIds.clear(); // Reset gaz for everyone
                }

                if (burntIds.size > 0) {
                    for (const targetId of burntIds) {
                        const target = this.players.get(targetId);
                        if (target && target.role.id === 'elder' && target.role.extraLife) {
                            target.role.extraLife = false;
                            await this.thread.send(`👴 L'Ancien a survécu à une attaque fatale cette nuit !`);
                        } else {
                            await this.applyDeath(targetId, 'PYROMANIAC_BURN');
                        }
                    }
                    await this.thread.send("🔥 **L'incendie s'est déclaré !** Tous les joueurs gazés ont péri dans les flammes.");
                }
            } else if (this.nightActions.pyroAction === 'GAS') {
                const pyros = Array.from(this.players.values()).filter(p => p.role.id === 'pyromaniac');
                for (const pyro of pyros) {
                    for (const targetId of this.nightActions.pyroGasTargetIds) {
                        pyro.role.gassedIds.add(targetId);
                    }
                }
            }

            // 5. Traitement Sorcière (Potion de Mort uniquement ici)
            // La potion de vie a été traitée en étape 1
            if (this.nightActions.witchActions.kill) {
                await this.applyDeath(this.nightActions.witchActions.kill, 'WITCH_POTION');
            }

            // 6. Application de la mort finale (Loups)
            // On vérifie d'abord l'Ancien (Extra Life)
            if (victimId) {
                const victim = this.players.get(victimId);
                if (victim && victim.role.id === 'elder' && victim.role.extraLife) {
                    victim.role.extraLife = false;
                    this.logEvent("L'Ancien a perdu une vie mais a survécu.");
                    await this.thread.send(`👴 L'Ancien a survécu à l'attaque des loups !`);
                } else {
                    await this.applyDeath(victimId, 'WEREWOLVES');
                }
            }

            // 7. Liaison Cupidon - DÉPLACÉ EN HAUT

            await this.concludeNight();

        } catch (error) {
            console.error('Error in finalizeNight:', error);
            await this.startDay();
        }
    }

    async concludeNight() {
        if (this.pendingHunter) {
            await this.thread.send("🔫 **Le Chasseur se meurt...** La nuit ne peut pas finir tant qu'il n'a pas tiré.");
            return;
        }

        // Clôture
        const deadDay = Array.from(this.players.values()).filter(p => p.justDied);
        if (this.turn === 1 && this.mayorId) {
            await this.thread.send(`🗳️ **Félicitations à <@${this.mayorId}> qui a été élu Maire !**`);
        }
        if (deadDay.length === 0) {
            await this.thread.send("🌅 **Le village se réveille...** Personne n'est mort cette nuit !");
        } else {
            const names = deadDay.map(p => `**${p.username}** (${p.role.name})`).join(', ');
            await this.thread.send(`🌅 **Le village se réveille...** Mais hélas, ${deadDay.length} habitant(s) nous ont quittés : ${names}.`);
        }

        for (const p of this.players.values()) p.justDied = false;

        await this.checkWinCondition();
        if (this.state !== 'END') {
            await this.startDay();
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

    async applyDeath(userId, cause = 'UNKNOWN') {
        const player = this.players.get(userId);
        if (!player || !player.isAlive) return;

        player.isAlive = false;
        player.justDied = true;
        this.recentDeadIds.push(player.id); // Ajouter à la liste pour le Fossoyeur
        this.logEvent(`**${player.username}** (${player.role.name}) est mort. (Cause: ${cause})`);

        // Check for Elder Sacrilege
        if (player.role.id === 'elder' && ['VILLAGE_VOTE', 'WITCH_POTION', 'HUNTER_SHOT', 'DICTATOR_DECREE'].includes(cause)) {
            await this.thread.send("😱 **SACRILÈGE !** L'Ancien a été tué par le village. Tous les villageois perdent leurs pouvoirs !");
            for (const p of this.players.values()) {
                if (p.role.team === 'VILLAGE') p.powerless = true;
            }
        }

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
                    // Ajouter au thread des loups si nécessaire
                    if ((p.role.team === 'WEREWOLF' || p.role.id === 'white_werewolf') && this.wolfThread) {
                        await this.wolfThread.members.add(p.id);
                        await this.wolfThread.send(`🐺 L'Héritier <@${p.id}> a rejoint la meute suite à un décès !`);
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

                        // Ajouter au thread des loups
                        if (this.wolfThread) {
                            await this.wolfThread.members.add(p.id);
                            const wolves = Array.from(this.players.values()).filter(pl => pl.isAlive && (pl.role.team === 'WEREWOLF' || pl.role.id === 'white_werewolf'));
                            const wolfNames = wolves.map(w => `**${w.username}**`).join(', ');
                            await this.wolfThread.send(`🐺 Bienvenue à <@${p.id}> dans la meute ! Les loups actuels sont : ${wolfNames}.`);
                        }
                    }
                } catch (e) {
                    console.error(`[ERROR] Failed to send Wild Child notification to ${p.id}:`, e.message);
                }
                await this.thread.send("🏹 L'Enfant Sauvage a perdu son guide et a rejoint les loups...");
            }
        }

        // Hunter logic
        if (player.role && player.role.id === 'hunter') {
            const unixTimestamp = Math.floor(Date.now() / 1000) + 30; // 30s timer
            await player.role.onDeath(this, player, unixTimestamp);
            this.pendingHunter = true;

            // Correction ci-dessous : Usage de hunterTimer manuel
            this.hunterTimer = setTimeout(async () => {
                if (this.pendingHunter) {
                    this.logEvent(`Le Chasseur ${player.username} n'a pas tiré à temps.`);
                    await this.thread.send(`⌚ **Temps écoulé !** Le coup part tout seul...`);

                    // Tir aléatoire
                    const potentialVictims = Array.from(this.players.values()).filter(p => p.isAlive && p.id !== player.id);
                    if (potentialVictims.length > 0) {
                        const randomVictim = potentialVictims[Math.floor(Math.random() * potentialVictims.length)];
                        await this.handleHunterAction(randomVictim.id);
                    } else {
                        this.pendingHunter = false;
                        await this.concludeNight();
                    }
                }
            }, 30 * 1000); // 30 seconds
        }

        // Lover logic
        if (player.lover) {
            const otherLover = this.players.get(player.lover);
            if (otherLover && otherLover.isAlive) {
                this.logEvent(`**${otherLover.username}** s'est suicidé par amour.`);
                await this.thread.send(`💘 Sous le choc de la perte de son amour, <@${otherLover.id}> se donne la mort.`);
                await this.applyDeath(otherLover.id, 'LOVE_SUICIDE');
            }
        }

        // Mayor Succession Logic
        if (this.mayorId === player.id) {
            const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
            if (alivePlayers.length > 0) {
                const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle('🎖️ Succession du Maire')
                    .setDescription(`Le Maire <@${player.id}> est mort ! Dans son dernier souffle, il doit désigner un successeur.\n\n<@${player.id}>, à qui donnes-tu l'insigne ?`)
                    .setColor('#3498db');

                const select = new StringSelectMenuBuilder()
                    .setCustomId('lg_mayor_successor')
                    .setPlaceholder('Choisir un successeur')
                    .addOptions(alivePlayers.map(p => ({
                        label: p.username,
                        value: p.id
                    })));

                const row = new ActionRowBuilder().addComponents(select);

                // Envoyer au thread privé ou public selon dispo
                const thread = this.playerThreads.get(player.id);
                if (thread) {
                    await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
                } else {
                    await this.thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
                }
            } else {
                this.mayorId = null;
            }
        }

        // Check win condition after each death
        await this.checkWinCondition();
    }

    async startDay() {
        if (this.state === 'END') return; // Loop Safety

        // Bloquer le démarrage du jour si le Chasseur doit tirer
        if (this.pendingHunter) {
            console.log("[Werewolf] StartDay bloqué par pendingHunter. Mise en attente.");
            this.dayPending = true;
            return;
        }

        this.state = 'DAY_VOTING';
        this.phase = 'DAY';
        await this.saveState();
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

        // Reset votes for the new day
        for (const player of this.players.values()) {
            player.voteTarget = null;
        }

        // Reset des morts pour le Fossoyeur (nouveau cycle Jour/Nuit commence)
        this.recentDeadIds = [];

        const timerSecs = await this.getRoundTimer();
        const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

        // Dictator Power Check
        if (!this.hasDictatorTakenOver) {
            const dictator = alivePlayers.find(p => p.role.id === 'dictator' && p.role.hasPower);
            if (dictator) {
                const dictThread = this.playerThreads.get(dictator.id);
                if (dictThread) {
                    await dictator.role.onDay(this, dictator, unixTimestamp, dictThread);
                }
            }
        }

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

        // 0. Match Nul (Tout le monde est mort)
        if (alivePlayers.length === 0) {
            winningTeam = 'draw';
            await this.thread.send('💀 **MATCH NUL !** Personne n\'a survécu à ce carnage.');
            const journalEmbed = await this.generateJournal('Match Nul');
            await this.thread.send({ embeds: [journalEmbed] });
            return true;
        }

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

        // 2. Victoire du Pyromane (Survivant Unique)
        if (!winningTeam && pyro && alivePlayers.length === 1 && !whiteWolf && wolves.length === 0) {
            winningTeam = 'pyromaniac';
            await this.thread.send('🔥 **VICTOIRE DU PYROMANE !** Il a réduit le village en cendres et rit seul au milieu des ruines.');
            const journalEmbed = await this.generateJournal('Victoire du Pyromane');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 3. Victoire du Loup Blanc (Survivant Unique)
        if (!winningTeam && whiteWolf && alivePlayers.length === 1 && wolves.length === 0) {
            winningTeam = 'white_werewolf';
            await this.thread.send('⚪ **VICTOIRE DU LOUP BLANC !** Il a dévoré tout le monde, même ses semblables.');
            const journalEmbed = await this.generateJournal('Victoire du Loup Blanc');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 4. Victoire du Village
        const realWolves = wolves.filter(p => p.role.id !== 'sorcerer');
        if (!winningTeam && realWolves.length === 0 && !whiteWolf && !pyro) {
            winningTeam = 'village';
            await this.thread.send('🎉 **VICTOIRE DU VILLAGE !** Tous les loups et menaces ont été éliminés.');
            const journalEmbed = await this.generateJournal('Victoire du Village');
            await this.thread.send({ embeds: [journalEmbed] });
        }

        // 5. Victoire des Loups
        // Les loups ne gagnent que s'ils sont majoritaires ET que le Loup Blanc est mort (sinon il continue de les traquer)
        if (!winningTeam && (wolves.length) >= (villagers.length + (pyro ? 1 : 0)) && !whiteWolf && !pyro) {
            winningTeam = 'werewolf';
            await this.thread.send('🐺 **VICTOIRE DES LOUPS-GAROUS !** Ils ont dévoré tout le village.');
            const journalEmbed = await this.generateJournal('Victoire des Loups');
            await this.thread.send({ embeds: [journalEmbed] });
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
        await this.deleteState(); // Game ended normally
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


    /**
     * Supprime les threads de jeu après un délai
     */
    async cleanupThreads(delayMs = 60000) {
        setTimeout(async () => {
            try {
                // Supprimer les threads privés
                for (const thread of this.playerThreads.values()) {
                    if (thread) await thread.delete().catch(() => { });
                }
                if (this.wolfThread) await this.wolfThread.delete().catch(() => { });

                // On garde le thread principal un peu plus longtemps ou on ne le supprime pas (archivage auto)
                if (this.thread) await this.thread.setArchived(true).catch(() => { });
            } catch (e) {
                console.error('[Werewolf] Error during thread cleanup:', e);
            }
        }, delayMs);
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

        // 🐦 Appliquer le malus du Corbeau (+2 votes)
        if (this.nightActions.crowTargetId) {
            const target = this.players.get(this.nightActions.crowTargetId);
            if (target && target.isAlive) {
                counts[target.id] = (counts[target.id] || 0) + 2;
                await this.thread.send(`🐦 **La malédiction du Corbeau** ajoute 2 votes contre <@${target.id}> !`);
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

            await this.applyDeath(victimId, this.hasDictatorTakenOver ? 'DICTATOR_DECREE' : 'VILLAGE_VOTE');
        }

        if (this.pendingHunter) {
            await this.thread.send("🔫 **Le Chasseur se meurt...** Le village retient son souffle en attendant son dernier tir.");
            return;
        }

        if (!(await this.checkWinCondition())) {
            await this.startNight();
        }
    }

    async handleHunterAction(victimId) {
        if (!this.pendingHunter) return;

        // Clear Hunter Timer
        if (this.hunterTimer) {
            clearTimeout(this.hunterTimer);
            this.hunterTimer = null;
        }

        this.pendingHunter = false;
        await this.applyDeath(victimId, 'HUNTER_SHOT');

        if (this.pendingHunter) {
            // Cascade
            await this.thread.send("🔫 **Coups de feu multiples !** Un autre Chasseur sort son arme...");
            return;
        }

        // Reprise différée du jour si nécessaire
        if (this.dayPending) {
            this.dayPending = false;
            await this.startDay();
            return;
        }

        if (!(await this.checkWinCondition())) {
            if (this.state === 'DAY_VOTING') {
                await this.startNight();
            } else if (this.state === 'NIGHT_RESOLUTION') {
                await this.concludeNight(); // Reprendre la fin de nuit proprement
            } else if (this.state === 'NIGHT') {
                await this.checkNightEnd();
            }
        }
    }

    async generateJournal(title) {
        // S'assurer que tous les joueurs sont en cache pour les mentions
        await cachePlayersForMentions(this.channel.guild, Array.from(this.players.values()));

        const embed = new EmbedBuilder()
            .setTitle(`📜 Journal : ${title}`)
            .setDescription(this.logs.join('\n') || "Aucun événement notable.")
            .setColor(this.theme.color)
            .setTimestamp();

        // Reveal all roles - Utiliser Nom + Mention pour parer au bug d'ID
        let revelation = "";
        for (const p of this.players.values()) {
            let status = `${p.isAlive ? '✅' : '💀'} **${p.username}** (<@${p.id}>) : **${p.role.name}**`;
            if (p.lover) {
                const lover = this.players.get(p.lover);
                status += ` 💘 (Amoureux de **${lover?.username || 'Inconnu'}**)`;
            }
            revelation += status + '\n';
        }
        embed.addFields({ name: '🎭 Révélation des rôles', value: revelation });

        return embed;
    }

    async stop() {
        this.clearTimers();
        if (this.hunterTimer) {
            clearTimeout(this.hunterTimer);
            this.hunterTimer = null;
        }

        this.state = 'END';
        this.pendingHunter = false;
        this.dayPending = false;

        await this.thread.send('🛑 **La partie a été arrêtée manuellement par un administrateur.**');

        // Nettoyage
        this.manager.endGame(this.channel.id);
        this.cleanupThreads(5000);
    }
}

module.exports = Game;
