const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const { CODM_GRADES } = require('../../systems/xp');
const { getProfile, updateProfile, getAllBackgrounds, getAllBadges, formatBadges, BADGES, RARITY_COLORS, checkAndAwardBadges } = require('../../systems/profiles');
const { getUserSubscription } = require('../../services/subscriptions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Affiche et personnalise ton profil')
        .addSubcommand(subcommand =>
            subcommand
                .setName('voir')
                .setDescription('Voir ton profil ou celui d\'un autre membre')
                .addUserOption(option =>
                    option.setName('membre')
                        .setDescription('Le membre dont tu veux voir le profil')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bio')
                .setDescription('Modifier ta bio')
                .addStringOption(option =>
                    option.setName('texte')
                        .setDescription('Ta nouvelle bio (max 200 caractères)')
                        .setRequired(true)
                        .setMaxLength(200)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('background')
                .setDescription('Changer ton fond de profil'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('couleur')
                .setDescription('Changer ta couleur d\'accent')
                .addStringOption(option =>
                    option.setName('hex')
                        .setDescription('Code couleur hexadécimal (ex: #FF5733)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('badges')
                .setDescription('Voir tous tes badges'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('titre')
                .setDescription('Définir un titre personnalisé (Premium)')
                .addStringOption(option =>
                    option.setName('texte')
                        .setDescription('Ton titre personnalisé (max 30 caractères)')
                        .setRequired(true)
                        .setMaxLength(30))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        switch (subcommand) {
            case 'voir':
                await handleViewProfile(interaction, guildId);
                break;
            case 'bio':
                await handleSetBio(interaction, guildId, userId);
                break;
            case 'background':
                await handleBackgroundSelect(interaction, guildId, userId);
                break;
            case 'couleur':
                await handleSetColor(interaction, guildId, userId);
                break;
            case 'badges':
                await handleViewBadges(interaction, guildId, userId);
                break;
            case 'titre':
                await handleSetTitle(interaction, guildId, userId);
                break;
        }
    }
};

async function handleViewProfile(interaction, guildId) {
    const targetMember = interaction.options.getMember('membre') || interaction.member;
    const targetId = targetMember.id;

    // Récupérer toutes les données nécessaires
    const [profile, userDoc, subscription, gradesDoc] = await Promise.all([
        getProfile(targetId, guildId),
        db.collection('guilds').doc(guildId).collection('users').doc(targetId).get(),
        getUserSubscription(targetId),
        db.collection('guilds').doc(guildId).collection('config').doc('grades').get()
    ]);

    const userData = userDoc.exists ? userDoc.data() : { xp: 0, level: 'Recrue' };
    const codmGrades = gradesDoc.exists ? gradesDoc.data().paliers : CODM_GRADES;

    // Vérifier et attribuer de nouveaux badges
    await checkAndAwardBadges(targetId, guildId, targetMember);

    // Récupérer les stats de jeu
    const gameStatsDoc = await db.collection('guilds').doc(guildId).collection('game_stats').doc(targetId).get();
    const gameStats = gameStatsDoc.exists ? gameStatsDoc.data() : {};

    // Calculer la progression vers le prochain grade
    const currentGrade = codmGrades.find(g => g.name === userData.level) || codmGrades[0];
    const currentIndex = codmGrades.findIndex(g => g.name === userData.level);
    const nextGrade = codmGrades[currentIndex + 1];

    let progressBar = '';
    let progressPercent = 100;

    if (nextGrade) {
        const currentXp = userData.xp - currentGrade.xp;
        const neededXp = nextGrade.xp - currentGrade.xp;
        progressPercent = Math.min(100, Math.floor((currentXp / neededXp) * 100));

        const filledBlocks = Math.floor(progressPercent / 10);
        const emptyBlocks = 10 - filledBlocks;
        progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    } else {
        progressBar = '█'.repeat(10);
    }

    // Construire l'embed
    const embed = new EmbedBuilder()
        .setColor(profile.accentColor || '#febc11')
        .setAuthor({
            name: targetMember.user.username,
            iconURL: targetMember.user.displayAvatarURL()
        })
        .setThumbnail(targetMember.user.displayAvatarURL({ size: 256 }));

    // Titre personnalisé ou par défaut
    if (profile.customTitle) {
        embed.setTitle(`${profile.customTitle}`);
    }

    // Badge d'abonnement
    let subscriptionBadge = '';
    if (subscription.tier.id === 'premium_plus') {
        subscriptionBadge = ' 👑';
    } else if (subscription.tier.id === 'premium') {
        subscriptionBadge = ' ⭐';
    }

    // Description avec bio
    let description = '';

    if (profile.bio) {
        description += `*"${profile.bio}"*\n\n`;
    }

    // Badges
    const badgeDisplay = formatBadges(profile.badges || []);
    if (badgeDisplay) {
        description += `**Badges:** ${badgeDisplay}${subscriptionBadge}\n\n`;
    } else if (subscriptionBadge) {
        description += `**Badges:** ${subscriptionBadge.trim()}\n\n`;
    }

    embed.setDescription(description || '*Aucune bio définie*');

    // Informations de rang
    embed.addFields(
        {
            name: `${currentGrade.emoji} Grade`,
            value: `**${userData.level}**`,
            inline: true
        },
        {
            name: '✨ XP',
            value: `**${userData.xp || 0}** XP`,
            inline: true
        },
        {
            name: '📊 Progression',
            value: nextGrade
                ? `\`${progressBar}\` ${progressPercent}%\n➜ ${nextGrade.emoji} ${nextGrade.name}`
                : `\`${progressBar}\` MAX`,
            inline: false
        }
    );

    // Statistiques de jeu si disponibles
    if (gameStats.werewolf) {
        const ww = gameStats.werewolf;
        const totalGames = (ww.wins || 0) + (ww.losses || 0);
        const winRate = totalGames > 0 ? Math.round((ww.wins / totalGames) * 100) : 0;

        embed.addFields({
            name: '🐺 Loup-Garou',
            value: `Parties: **${totalGames}** | Victoires: **${ww.wins || 0}** | Taux: **${winRate}%**`,
            inline: false
        });
    }

    // Membre depuis
    if (targetMember.joinedAt) {
        const joinDate = Math.floor(targetMember.joinedAt.getTime() / 1000);
        embed.addFields({
            name: '📅 Membre depuis',
            value: `<t:${joinDate}:R>`,
            inline: true
        });
    }

    embed.setFooter({
        text: `ID: ${targetId}`,
        iconURL: interaction.guild.iconURL()
    });
    embed.setTimestamp();

    // Boutons d'action
    const row = new ActionRowBuilder();

    if (targetId === interaction.user.id) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('profile_edit_bio')
                .setLabel('Modifier Bio')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_edit_background')
                .setLabel('Background')
                .setEmoji('🎨')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_view_badges')
                .setLabel('Badges')
                .setEmoji('🏅')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    await interaction.reply({
        embeds: [embed],
        components: row.components.length > 0 ? [row] : []
    });
}

async function handleSetBio(interaction, guildId, userId) {
    const bio = interaction.options.getString('texte');

    await updateProfile(userId, guildId, { bio });

    await interaction.reply({
        content: `✅ Ta bio a été mise à jour :\n*"${bio}"*`,
        flags: [64]
    });
}

async function handleBackgroundSelect(interaction, guildId, userId) {
    const subscription = await getUserSubscription(userId);
    const isPremium = subscription.tier.id !== 'free';

    const backgrounds = getAllBackgrounds();
    const profile = await getProfile(userId, guildId);

    const options = backgrounds.map(bg => ({
        label: bg.name,
        value: bg.id,
        description: bg.premium ? '⭐ Premium requis' : 'Gratuit',
        emoji: bg.premium ? '🔒' : '🎨',
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

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: [64]
    });
}

async function handleSetColor(interaction, guildId, userId) {
    let color = interaction.options.getString('hex');

    // Valider le format hexadécimal
    if (!color.startsWith('#')) {
        color = '#' + color;
    }

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(color)) {
        return interaction.reply({
            content: '❌ Format de couleur invalide. Utilise un code hexadécimal (ex: #FF5733).',
            flags: [64]
        });
    }

    await updateProfile(userId, guildId, { accentColor: color.toUpperCase() });

    const embed = new EmbedBuilder()
        .setTitle('✅ Couleur mise à jour')
        .setDescription(`Ta nouvelle couleur d'accent est **${color.toUpperCase()}**`)
        .setColor(color);

    await interaction.reply({
        embeds: [embed],
        flags: [64]
    });
}

async function handleViewBadges(interaction, guildId, userId) {
    const profile = await getProfile(userId, guildId);
    const userBadges = profile.badges || [];
    const allBadges = getAllBadges();

    // Vérifier et attribuer de nouveaux badges
    const newBadges = await checkAndAwardBadges(userId, guildId, interaction.member);

    let description = '';

    // Badges possédés
    const ownedBadges = allBadges.filter(b => userBadges.includes(b.id));
    if (ownedBadges.length > 0) {
        description += '**Tes badges :**\n';
        ownedBadges.forEach(badge => {
            const rarityColor = RARITY_COLORS[badge.rarity] || '#95a5a6';
            description += `${badge.emoji} **${badge.name}** - ${badge.description}\n`;
        });
        description += '\n';
    }

    // Badges non possédés
    const missingBadges = allBadges.filter(b => !userBadges.includes(b.id) && b.rarity !== 'special');
    if (missingBadges.length > 0) {
        description += '**Badges à débloquer :**\n';
        missingBadges.slice(0, 10).forEach(badge => {
            description += `🔒 ~~${badge.emoji} ${badge.name}~~ - ${badge.description}\n`;
        });

        if (missingBadges.length > 10) {
            description += `\n*Et ${missingBadges.length - 10} autres badges à découvrir...*`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('🏅 Collection de Badges')
        .setDescription(description || 'Aucun badge pour l\'instant.')
        .setColor(profile.accentColor || '#febc11')
        .setFooter({ text: `${ownedBadges.length}/${allBadges.filter(b => b.rarity !== 'special').length} badges collectés` });

    // Notifier les nouveaux badges
    if (newBadges.length > 0) {
        const newBadgesList = newBadges.map(b => `${b.emoji} ${b.name}`).join(', ');
        embed.addFields({
            name: '🎉 Nouveaux badges débloqués !',
            value: newBadgesList
        });
    }

    await interaction.reply({
        embeds: [embed],
        flags: [64]
    });
}

async function handleSetTitle(interaction, guildId, userId) {
    const title = interaction.options.getString('texte');

    // Vérifier l'abonnement
    const subscription = await getUserSubscription(userId);
    if (subscription.tier.id === 'free') {
        return interaction.reply({
            content: '⭐ Cette fonctionnalité nécessite un abonnement **Premium**.',
            flags: [64]
        });
    }

    await updateProfile(userId, guildId, { customTitle: title });

    await interaction.reply({
        content: `✅ Ton titre personnalisé a été défini : **${title}**`,
        flags: [64]
    });
}
