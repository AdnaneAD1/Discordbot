const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const Player = require('./Player');

class Game {
    constructor(client, channel, host, manager) {
        this.client = client;
        this.channel = channel;
        this.host = host;
        this.manager = manager;

        this.players = new Map(); // UserID -> Player
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
    }

    logEvent(message) {
        this.logs.push(`• ${message}`);
    }

    async startLobby() {
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🐺 Loup-Garou - Nouvelle Partie')
            .setDescription(`Le Maire **${this.host.username}** recrute des villageois !\n\n**Joueurs (1/25) :**\n${this.host} (Hôte)`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/1993/1993290.png'); // Icone loup générique

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lg_join').setLabel('Rejoindre').setStyle(ButtonStyle.Success).setEmoji('✋'),
            new ButtonBuilder().setCustomId('lg_leave').setLabel('Quitter').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('lg_start').setLabel('Lancer la partie').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
            new ButtonBuilder().setCustomId('lg_config_composition').setLabel('Composition').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
        );

        this.addPlayer(this.host);

        // Création d'un thread dédié pour la partie
        /* 
           Note: Sur Discord, les threads privés nécessitent un niveau de boost ou d'être dans un channel forum/text spécifique.
           Pour simplifier, on fera un thread public "Partie en cours" que seuls les joueurs devraient lire,
           ou alors on gère les permissions si on est dans un salon privé.
        */

        this.lobbyMessage = await this.channel.send({ embeds: [embed], components: [row] });
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

        // 2. Distribute Roles
        const roles = this.generateRoles(this.players.size);
        const shuffledRoles = roles.sort(() => Math.random() - 0.5);

        // Assign roles
        let i = 0;
        for (const player of this.players.values()) {
            player.assignRole(shuffledRoles[i]);
            i++;
            // Send DM
            try {
                const user = await this.client.users.fetch(player.id);
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`Tu es ${player.role.name} ${player.role.emoji}`)
                    .setDescription(player.role.description)
                    .setColor(player.role.team === 'WEREWOLF' ? '#ff0000' : '#00ff00');

                const { AttachmentBuilder } = require('discord.js');
                const files = [];

                if (player.role.imagePath) {
                    const path = require('path');
                    const fs = require('fs');
                    const imgPath = path.join(__dirname, '..', '..', 'assets', 'roles', player.role.imagePath);

                    if (fs.existsSync(imgPath)) {
                        const attachment = new AttachmentBuilder(imgPath, { name: player.role.imagePath });
                        dmEmbed.setImage(`attachment://${player.role.imagePath}`);
                        files.push(attachment);
                    } else {
                        console.warn(`[WARNING] Role image not found: ${imgPath}`);
                    }
                }

                await user.send({ embeds: [dmEmbed], files: files });
                console.log(`[INFO] Role DM sent to ${user.tag}`);
            } catch (e) {
                console.error(`[ERROR] Failed to send role DM to ${player.id} (${player.username}):`, e.message);
                this.thread.send(`⚠️ Impossible d'envoyer le rôle à <@${player.id}> en MP (Erreur: ${e.message}). Vérifie tes paramètres de confidentialité !`);
            }
        }
        this.logEvent("Distribution des rôles terminée.");

        // 3. Start Night
        await this.startNight();
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

        if (this.customRoles && this.customRoles.length > 0) {
            let roles = this.customRoles.map(id => new roleMap[id]());

            // 1. Ajuster la taille en priorité
            if (roles.length < count) {
                while (roles.length < count) roles.push(new Villageois());
            } else if (roles.length > count) {
                roles = roles.slice(0, count);
            }

            // 2. Sécurité : Vérifier la présence d'au moins un Loup-Garou (basique)
            // Note: on vérifie sur les instances créées car roles a été redimensionné
            const hasWolf = roles.some(r => r.id === 'werewolf');

            if (!hasWolf) {
                // On privilégie de remplacer un simple Villageois pour ne pas perdre un rôle spécial
                const villagerIndex = roles.findIndex(r => r.id === 'villager');
                if (villagerIndex !== -1) {
                    roles[villagerIndex] = new LoupGarou();
                } else {
                    // Si vraiment pas de villageois, on remplace le premier rôle
                    roles[0] = new LoupGarou();
                }
            }
            return roles;
        }

        const roles = [];
        const wolfCount = Math.max(1, Math.floor(count / 4));
        for (let i = 0; i < wolfCount; i++) roles.push(new LoupGarou());

        if (count >= 4) roles.push(new Voyante());
        if (count >= 5) roles.push(new Sorciere());
        if (count >= 6) roles.push(new Chasseur());
        if (count >= 7) roles.push(new Cupidon());
        if (count >= 8) roles.push(new Garde());
        if (count >= 9) roles.push(new Mentaliste());
        if (count >= 10) roles.push(new Fossoyeur());
        if (count >= 11) roles.push(new Dictateur());
        if (count >= 12) roles.push(new LoupBlanc());
        if (count >= 13) roles.push(new Corbeau());
        if (count >= 14) roles.push(new Ancien());
        if (count >= 15) roles.push(new Heritier());

        while (roles.length < count) {
            roles.push(new Villageois());
        }

        return roles;
    }

    async startNight() {
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
                await player.role.onNight(this, player, unixTimestamp);
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
        this.clearTimers();
        this.state = 'DAY';

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
                    { label: `Infecter ${target.username}`, value: victimId },
                    { label: 'Ne rien faire', value: 'skip' }
                ]);
            const row = new ActionRowBuilder().addComponents(select);
            try {
                const user = await this.client.users.fetch(blackWolf.id);
                await user.send({ embeds: [embed], components: [row] });
            } catch (e) { }
            // Note: checkNightEnd needs to wait for black wolf if he decides to infect.
            // But usually infection happens in a special turn. 
            // We'll handle it by adding a check in handleNightResult.
        }

        // 2. Traitement Infection Loup Noir
        if (this.nightActions.blackWolfInfectedId && this.nightActions.blackWolfInfectedId !== 'skip' && victimId === this.nightActions.blackWolfInfectedId) {
            const victim = this.players.get(this.nightActions.blackWolfInfectedId);
            victim.role.team = 'WEREWOLF';
            victim.isInfected = true;
            victimId = null; // Il ne meurt plus, il est infecté

            // Message au nouveau loup
            try {
                const user = await this.client.users.fetch(victim.id);
                await user.send("🖤 **Tu as été infecté !** Tu es désormais un Loup-Garou et tu gagnes avec eux.");
            } catch (e) {
                console.error(`[ERROR] Failed to send infection DM to ${victim.id}:`, e.message);
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
                    const u1 = await this.client.users.fetch(p1.id);
                    const u2 = await this.client.users.fetch(p2.id);
                    await u1.send(`💘 Tu es amoureux de **${p2.username}** ! Si l'un meurt, l'autre aussi.`);
                    await u2.send(`💘 Tu es amoureux de **${p1.username}** ! Si l'un meurt, l'autre aussi.`);
                } catch (e) {
                    console.error(`[ERROR] Failed to send Lovers DM:`, e.message);
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

        if (!this.checkWinCondition()) {
            const timerSecs = await this.getRoundTimer();
            const unixTimestamp = Math.floor((Date.now() + (timerSecs * 1000)) / 1000);

            // Dictateur : Hook Day
            for (const p of this.players.values()) {
                if (p.isAlive && p.role.onDay) await p.role.onDay(this, p, unixTimestamp);
            }

            // Élection du Maire le premier matin
            if (this.turn === 1 && !this.mayorId) {
                await this.startMayorElection();
            } else {
                await this.startDay();
            }
        }
    }

    async startMayorElection() {
        this.state = 'MAYOR_ELECTION';
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

        const unixTimestamp = Math.floor((Date.now() + 30000) / 1000);
        const embed = new EmbedBuilder()
            .setTitle('🗳️ Élection du Maire')
            .setDescription(`Le village a besoin d'un chef ! Qui voulez-vous élire comme Maire ?\n*(Le Maire a un vote qui compte double en cas d'égalité)*\n\n⏱️ **Fin de l'élection :** <t:${unixTimestamp}:R>`)
            .setColor('#3498db');

        // ... (rest of the select menu code)
        const { StringSelectMenuBuilder } = require('discord.js');
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
        for (const player of this.players.values()) {
            if (player.isAlive && player.mayorVote) {
                counts[player.mayorVote] = (counts[player.mayorVote] || 0) + 1;
                player.mayorVote = null;
            }
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
                    const user = await this.client.users.fetch(p.id);
                    await user.send(`📜 Ton protecteur est mort. Tu hérites de son rôle : **${p.role.name}** !`);
                } catch (e) {
                    console.error(`[ERROR] Failed to send Heir DM to ${p.id}:`, e.message);
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
                    const user = await this.client.users.fetch(p.id);
                    await user.send("🏹 **Ton modèle est mort.** La haine t'envahit... Tu es désormais un Loup-Garou !");
                } catch (e) {
                    console.error(`[ERROR] Failed to send Wild Child DM to ${p.id}:`, e.message);
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

    startTimer(seconds, callback) {
        if (this.timer) clearTimeout(this.timer);
        this.timerEnd = Date.now() + (seconds * 1000);

        this.timer = setTimeout(async () => {
            await callback();
        }, seconds * 1000);

        // Optionnel : Notification de fin de temps
        this.timerUpdate = setInterval(async () => {
            const remaining = Math.round((this.timerEnd - Date.now()) / 1000);

            if (remaining <= 0) {
                clearInterval(this.timerUpdate);
                if (this.state === 'DAY_VOTING' || this.state === 'MAYOR_ELECTION') {
                    await this.thread.send("⌛ **Temps écoulé !** Analyse des votes en cours...").catch(() => { });
                } else if (this.state === 'NIGHT') {
                    await this.thread.send("⌛ **La nuit touche à sa fin...** Le village se réveille.").catch(() => { });
                }
                return;
            }
        }, 5000);
    }

    clearTimers() {
        if (this.timer) clearTimeout(this.timer);
        if (this.timerUpdate) clearInterval(this.timerUpdate);
    }

    checkWinCondition() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const wolves = alivePlayers.filter(p => p.role.team === 'WEREWOLF');
        const villagers = alivePlayers.filter(p => p.role.team === 'VILLAGE');
        const whiteWolf = alivePlayers.find(p => p.role.id === 'white_werewolf');
        const pyro = alivePlayers.find(p => p.role.id === 'pyromaniac');

        if (pyro && alivePlayers.length <= 2) {
            this.thread.send('🔥 **VICTOIRE DU PYROMANE !** Il a réduit le village en cendres et rit seul au milieu des ruines.');
            this.generateJournal('Victoire du Pyromane').then(embed => this.thread.send({ embeds: [embed] }));
            this.manager.endGame(this.channel.id);
            return true;
        }

        if (whiteWolf && alivePlayers.length <= 2) {
            this.thread.send('⚪ **VICTOIRE DU LOUP BLANC !** Il a dévoré tout le monde, même ses semblables.');
            this.generateJournal('Victoire du Loup Blanc').then(embed => this.thread.send({ embeds: [embed] }));
            this.manager.endGame(this.channel.id);
            return true;
        }

        if (wolves.length === 0 && !whiteWolf) {
            this.thread.send('🎉 **VICTOIRE DU VILLAGE !** Tous les loups ont été éliminés.');
            this.generateJournal('Victoire du Village').then(embed => this.thread.send({ embeds: [embed] }));
            this.manager.endGame(this.channel.id);
            return true;
        } else if ((wolves.length + (whiteWolf ? 1 : 0)) >= villagers.length) {
            // Si le loup blanc est là, on ne finit pas forcément si c'est les loups qui restent
            if (!whiteWolf) {
                this.thread.send('🐺 **VICTOIRE DES LOUPS-GAROUS !** Ils ont dévoré tout le village.');
                this.generateJournal('Victoire des Loups').then(embed => this.thread.send({ embeds: [embed] }));
                this.manager.endGame(this.channel.id);
                return true;
            }
        }
        return false;
    }

    async handleVillageVoteResult() {
        if (this.state !== 'DAY_VOTING') return;
        this.clearTimers();

        let victimId = null;

        if (this.hasDictatorTakenOver) {
            // Seul le vote du dictateur compte
            const dictator = Array.from(this.players.values()).find(p => p.role.id === 'dictator');
            victimId = dictator.voteTarget;
            this.hasDictatorTakenOver = false; // Reset
        } else {
            const counts = {};

            // Votes du Corbeau
            if (this.nightActions.crowTargetId) {
                counts[this.nightActions.crowTargetId] = 2;
                await this.thread.send(`🐦 Le Corbeau a porté malheur à <@${this.nightActions.crowTargetId}> (+2 votes) !`);
            }

            for (const player of this.players.values()) {
                if (player.isAlive && player.voteTarget) {
                    const weight = (player.id === this.mayorId) ? 2 : 1;
                    counts[player.voteTarget] = (counts[player.voteTarget] || 0) + weight;
                    player.voteTarget = null; // Reset
                }
            }

            if (Object.keys(counts).length > 0) {
                victimId = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
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

        if (!this.checkWinCondition()) {
            await this.startNight();
        }
    }

    async generateJournal(title) {
        const embed = new EmbedBuilder()
            .setTitle(`📜 Journal : ${title}`)
            .setDescription(this.logs.join('\n') || "Aucun événement notable.")
            .setColor('#7f8c8d')
            .setTimestamp();

        // Reveal all roles
        let revelation = "";
        for (const p of this.players.values()) {
            revelation += `${p.isAlive ? '✅' : '💀'} <@${p.id}> : **${p.role.name}**\n`;
        }
        embed.addFields({ name: '🎭 Révélation des rôles', value: revelation });

        return embed;
    }

    stop() {
        this.clearTimers();
        if (this.thread) this.thread.setArchived(true).catch(() => { });
        if (this.wolfThread) this.wolfThread.setArchived(true).catch(() => { });
        this.manager.endGame(this.channel.id);
        this.channel.send("🛑 **Partie annulée par l'administrateur.**");
    }
}

module.exports = Game;
