const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupconfig')
        .setDescription('Configure les salons, rôles et paliers d\'XP du serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => option.setName('welcome_channel').setDescription('Salon pour les messages de bienvenue'))
        .addChannelOption(option => option.setName('rules_channel').setDescription('Salon pour le règlement'))
        .addRoleOption(option => option.setName('unverified_role').setDescription('Rôle pour les nouveaux (non vérifiés)'))
        .addRoleOption(option => option.setName('member_role').setDescription('Rôle pour les membres vérifiés'))
        .addStringOption(option => option.setName('server_name').setDescription('Nom personnalisé du serveur'))
        .addStringOption(option => option.setName('color').setDescription('Couleur des embeds en HEX (ex: #FF0000)'))
        .addChannelOption(option => option.setName('giveaway_channel').setDescription('Salon pour les annonces de giveaways'))
        .addChannelOption(option => option.setName('music_channel').setDescription('Salon vocal par défaut pour la musique'))
        .addChannelOption(option => option.setName('music_text_channel').setDescription('Salon textuel EXCLUSIF pour les commandes de musique'))
        .addChannelOption(option => option.setName('werewolf_channel').setDescription('Salon pour le jeu Loup-Garou'))
        .addChannelOption(option => option.setName('rank_up_channel').setDescription('Salon pour les annonces de passage de grade'))
        .addIntegerOption(option => option.setName('werewolf_timer').setDescription('Durée du compte à rebours (secondes)')),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildConfigRef = db.collection('guilds').doc(guildId).collection('config');

        const options = {
            welcomeChannel: interaction.options.getChannel('welcome_channel'),
            rulesChannel: interaction.options.getChannel('rules_channel'),
            unverifiedRole: interaction.options.getRole('unverified_role'),
            memberRole: interaction.options.getRole('member_role'),
            serverName: interaction.options.getString('server_name'),
            color: interaction.options.getString('color'),
            giveawayChannel: interaction.options.getChannel('giveaway_channel'),
            musicChannel: interaction.options.getChannel('music_channel'),
            musicTextChannel: interaction.options.getChannel('music_text_channel'),
            rankUpChannel: interaction.options.getChannel('rank_up_channel'),
            werewolfChannel: interaction.options.getChannel('werewolf_channel'),
            werewolfTimer: interaction.options.getInteger('werewolf_timer'),
            musicChannel: interaction.options.getChannel('music_channel'),
            musicTextChannel: interaction.options.getChannel('music_text_channel'),
            rankUpChannel: interaction.options.getChannel('rank_up_channel'),
            werewolfChannel: interaction.options.getChannel('werewolf_channel'),
            xpVeteran: interaction.options.getInteger('xp_veteran'),
            xpElite: interaction.options.getInteger('xp_elite'),
            xpPro: interaction.options.getInteger('xp_pro'),
            xpMaitre: interaction.options.getInteger('xp_maitre'),
            xpGrandMaitre: interaction.options.getInteger('xp_grand_maitre'),
            xpLegendaire: interaction.options.getInteger('xp_legendaire'),
        };

        const updates = [];

        if (options.welcomeChannel) {
            await guildConfigRef.doc('channels').set({ welcomeChannelId: options.welcomeChannel.id }, { merge: true });
            updates.push(`✅ Bienvenue : <#${options.welcomeChannel.id}>`);
        }

        if (options.giveawayChannel) {
            await guildConfigRef.doc('channels').set({ giveawayChannelId: options.giveawayChannel.id }, { merge: true });
            updates.push(`✅ Giveaways : <#${options.giveawayChannel.id}>`);
        }

        if (options.werewolfChannel) {
            await guildConfigRef.doc('channels').set({ werewolfChannelId: options.werewolfChannel.id }, { merge: true });
            updates.push(`✅ Loup-Garou : <#${options.werewolfChannel.id}>`);

            const GameInfo = require('../../systems/werewolf/GameInfo');
            await GameInfo.sendAll(options.werewolfChannel);
        }

        if (options.werewolfTimer) {
            await guildConfigRef.doc('werewolf').set({ timer: options.werewolfTimer }, { merge: true });
            updates.push(`✅ Timer Loup-Garou : **${options.werewolfTimer}s**`);
        }

        if (options.ticketCategory) {
            await guildConfigRef.doc('tickets').set({ categoryId: options.ticketCategory.id }, { merge: true });
            updates.push(`✅ Catégorie Tickets : **${options.ticketCategory.name}**`);
        }

        if (options.staffRole) {
            await guildConfigRef.doc('tickets').set({ staffRoleId: options.staffRole.id }, { merge: true });
            updates.push(`✅ Rôle Staff : <@&${options.staffRole.id}>`);
        }

        if (options.musicChannel) {
            await guildConfigRef.doc('channels').set({ defaultVoiceChannelId: options.musicChannel.id }, { merge: true });
            updates.push(`✅ Salon Vocal Musique : <#${options.musicChannel.id}>`);
        }

        if (options.musicTextChannel) {
            await guildConfigRef.doc('channels').set({ musicTextChannelId: options.musicTextChannel.id }, { merge: true });
            updates.push(`✅ Salon Textuel Musique : <#${options.musicTextChannel.id}>`);
        }

        if (options.rankUpChannel) {
            await guildConfigRef.doc('channels').set({ rankUpChannelId: options.rankUpChannel.id }, { merge: true });
            updates.push(`✅ Salon Grades : <#${options.rankUpChannel.id}>`);
        }

        if (options.unverifiedRole) {
            await guildConfigRef.doc('roles').set({ unverifiedRoleId: options.unverifiedRole.id }, { merge: true });
            updates.push(`✅ Rôle Non-Vérifié : <@&${options.unverifiedRole.id}>`);
        }

        if (options.memberRole) {
            await guildConfigRef.doc('roles').set({ memberRoleId: options.memberRole.id }, { merge: true });
            updates.push(`✅ Rôle Membre : <@&${options.memberRole.id}>`);
        }
        // Handle XP Grades customization
        if (options.xpVeteran || options.xpElite || options.xpPro || options.xpMaitre || options.xpGrandMaitre || options.xpLegendaire) {
            const gradesDoc = await guildConfigRef.doc('grades').get();
            let currentGrades = gradesDoc.exists ? gradesDoc.data().paliers : [
                { name: "Recrue", xp: 0 },
                { name: "Vétéran", xp: 200 },
                { name: "Élite", xp: 600 },
                { name: "Pro", xp: 1200 },
                { name: "Maître", xp: 2500 },
                { name: "Grand Maître", xp: 5000 },
                { name: "Légendaire", xp: 10000 }
            ];

            if (options.xpVeteran) currentGrades.find(g => g.name === "Vétéran").xp = options.xpVeteran;
            if (options.xpElite) currentGrades.find(g => g.name === "Élite").xp = options.xpElite;
            if (options.xpPro) currentGrades.find(g => g.name === "Pro").xp = options.xpPro;
            if (options.xpMaitre) currentGrades.find(g => g.name === "Maître").xp = options.xpMaitre;
            if (options.xpGrandMaitre) currentGrades.find(g => g.name === "Grand Maître").xp = options.xpGrandMaitre;
            if (options.xpLegendaire) currentGrades.find(g => g.name === "Légendaire").xp = options.xpLegendaire;

            await guildConfigRef.doc('grades').set({ paliers: currentGrades }, { merge: true });
            updates.push(`✅ Paliers d'XP mis à jour`);
        }

        if (updates.length === 0) {
            return interaction.reply({ content: '❌ Aucune option modifiée.', flags: [64] });
        }

        const setupEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('⚙️ CONFIGURATION SERVEUR')
            .setDescription(updates.join('\n'))
            .setTimestamp();

        await interaction.reply({ embeds: [setupEmbed] });
    },
};
