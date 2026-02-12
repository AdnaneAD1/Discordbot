const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const { CODM_GRADES } = require('../../systems/xp');
const { getProfile, updateProfile, getAllBackgrounds, getAllBadges, formatBadges, BADGES, RARITY_COLORS, checkAndAwardBadges } = require('../../systems/profiles');
const { getUserSubscription } = require('../../services/subscriptions');
const { generateProfileCard } = require('../../services/profileCard');
const { AttachmentBuilder } = require('discord.js');

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
                        .setMaxLength(30)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('social')
                .setDescription('Ajouter tes réseaux sociaux (Premium)')
                .addStringOption(option =>
                    option.setName('plateforme')
                        .setDescription('La plateforme à ajouter')
                        .setRequired(true)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitch', value: 'twitch' },
                            { name: 'Instagram', value: 'instagram' },
                            { name: 'TikTok', value: 'tiktok' }
                        ))
                .addStringOption(option =>
                    option.setName('lien')
                        .setDescription('Lien ou pseudo (ex: @username ou youtube.com/c/nom)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('banner')
                .setDescription('Définir une bannière d\'embed (Premium+)')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('URL de l\'image (PNG/JPG)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('featured')
                .setDescription('Mettre en avant tes badges (max 5)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('privacy')
                .setDescription('Gérer ta confidentialité (Premium)')),

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
            case 'social':
                await handleSetSocial(interaction, guildId, userId);
                break;
            case 'banner':
                await handleSetBanner(interaction, guildId, userId);
                break;
            case 'featured':
                await handleFeaturedBadges(interaction, guildId, userId);
                break;
            case 'privacy':
                await handleSetPrivacy(interaction, guildId, userId);
                break;
        }
    }
};

async function handleSetBanner(interaction, guildId, userId) {
    const bannerUrl = interaction.options.getString('url');
    const subscription = await getUserSubscription(userId);

    if (subscription.tier.id !== 'premium_plus') {
        return interaction.reply({ content: '⭐ Les bannières sont réservées aux membres **Premium+**.', flags: [64] });
    }

    if (!bannerUrl.match(/\.(jpeg|jpg|gif|png)$/) || !bannerUrl.startsWith('http')) {
        return interaction.reply({ content: '❌ URL invalide. L\'image doit être au format PNG, JPG ou GIF.', flags: [64] });
    }

    await updateProfile(userId, guildId, { banner: bannerUrl });
    await interaction.reply({ content: '✅ Ta bannière de profil a été mise à jour !', flags: [64] });
}

async function handleFeaturedBadges(interaction, guildId, userId) {
    const profile = await getProfile(userId, guildId);
    const userBadges = profile.badges || [];

    if (userBadges.length === 0) {
        return interaction.reply({ content: '❌ Tu n\'as aucun badge à mettre en avant.', flags: [64] });
    }

    const options = userBadges.map(id => {
        const badge = BADGES[id];
        return {
            label: badge?.name || id,
            value: id,
            emoji: badge?.emoji || '🏅',
            default: (profile.featuredBadges || []).includes(id)
        };
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId('profile_featured_select')
        .setPlaceholder('Sélectionne tes badges (max 5)')
        .setMinValues(0)
        .setMaxValues(Math.min(5, options.length))
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply({ content: '🏅 **Badges à la Une**\nChoisis jusqu\'à 5 badges à afficher en priorité sur ton profil.', components: [row], flags: [64] });
}

async function handleSetPrivacy(interaction, guildId, userId) {
    const subscription = await getUserSubscription(userId);
    if (subscription.tier.id === 'free') {
        return interaction.reply({ content: '⭐ La gestion de la confidentialité est réservée aux membres **Premium**.', flags: [64] });
    }

    const profile = await getProfile(userId, guildId);
    const privacy = profile.privacy || { showStats: true, showRank: true, showXp: true };

    const options = [
        { label: 'Afficher les Statistiques', value: 'showStats', emoji: '📊', default: privacy.showStats },
        { label: 'Afficher le Grade', value: 'showRank', emoji: '🎖️', default: privacy.showRank },
        { label: 'Afficher l\'XP', value: 'showXp', emoji: '✨', default: privacy.showXp }
    ];

    const select = new StringSelectMenuBuilder()
        .setCustomId('profile_privacy_select')
        .setPlaceholder('Gérer les éléments visibles')
        .setMinValues(0)
        .setMaxValues(3)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply({ content: '🔒 **Paramètres de Confidentialité**\nSélectionne les éléments que tu souhaites rendre publics sur ton profil.', components: [row], flags: [64] });
}

async function handleSetSocial(interaction, guildId, userId) {
    const platform = interaction.options.getString('plateforme');
    const link = interaction.options.getString('lien');

    const subscription = await getUserSubscription(userId);
    const isPremium = subscription.tier.id !== 'free';
    const profile = await getProfile(userId, guildId);

    const hasSocialFeature = isPremium || (profile.unlockedFeatures || []).includes('social_links');

    if (!hasSocialFeature) {
        return interaction.reply({
            content: '⭐ L\'ajout de réseaux sociaux est réservé aux membres **Premium**.\n\n' +
                '💡 Tu peux aussi débloquer cette option définitivement pour **20,000 🪙** via ton `/profile` ! (Bientôt disponible en bouton)',
            flags: [64]
        });
    }
    const socialLinks = profile.socialLinks || {};
    socialLinks[platform] = link;

    await updateProfile(userId, guildId, { socialLinks });

    await interaction.reply({
        content: `✅ Ton lien **${platform}** a été mis à jour : \`${link}\``,
        flags: [64]
    });
}

async function handleViewProfile(interaction, guildId) {
    const targetMember = interaction.options.getMember('membre') || interaction.member;
    const targetId = targetMember.id;

    // Récupérer toutes les données nécessaires
    const [profile, userDoc, subscription, guildSub, gradesDoc] = await Promise.all([
        getProfile(targetId, guildId),
        db.collection('guilds').doc(guildId).collection('users').doc(targetId).get(),
        getUserSubscription(targetId),
        require('../../services/subscriptions').isGuildPremium(guildId), // Guild premium status
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

    // Badge d'abonnement (Utilisations des badges définis dans profiles.js)
    let subscriptionBadge = '';
    const { BADGES } = require('../../systems/profiles');

    if (subscription.tier.id === 'premium_plus') {
        subscriptionBadge = ` ${BADGES.titan_server.emoji}`;
    } else if (subscription.tier.id === 'premium') {
        subscriptionBadge = ` ${BADGES.sigma_player.emoji}`;
    }

    // Badge Serveur Titan (Si le serveur est sponsorisé par un Titan)
    let guildBadge = '';
    if (guildSub.isPremium && guildSub.tier.id === 'premium_plus') {
        guildBadge = ` ${BADGES.titan_guild.emoji}`;
    }

    // Construire l'embed
    const embed = new EmbedBuilder()
        .setColor(profile.accentColor || '#febc11')
        .setAuthor({
            name: targetMember.user.username,
            iconURL: targetMember.user.displayAvatarURL()
        })
        .setThumbnail(targetMember.user.displayAvatarURL({ size: 256 }));

    // Bannière (Premium+)
    if (profile.banner && (subscription.tier.id === 'premium_plus' || targetId === interaction.user.id)) {
        embed.setImage(profile.banner);
    }

    // Titre personnalisé ou par défaut
    if (profile.customTitle) {
        embed.setTitle(`${profile.customTitle}${subscriptionBadge}${guildBadge}`);
    } else {
        embed.setTitle(`${targetMember.user.username}${subscriptionBadge}${guildBadge}`);
    }

    // Description avec bio et Badges à la une
    let description = '';

    // Badges à la une (Sigma Feature)
    const featuredBadges = profile.featuredBadges || [];
    if (featuredBadges.length > 0) {
        description += `${formatBadges(featuredBadges)}\n\n`;
    }

    if (profile.bio) {
        description += `*"${profile.bio}"*\n\n`;
    }

    // Badges normaux (si non masqués ou si c'est le sien)
    const badgeDisplay = formatBadges(profile.badges || []);
    if (badgeDisplay) {
        description += `**Collection:** ${badgeDisplay}${subscriptionBadge}\n\n`;
    } else if (subscriptionBadge) {
        description += `**Abonnement:** ${subscriptionBadge.trim()}\n\n`;
    }

    embed.setDescription(description || '*Aucune bio définie*');

    // Réseaux Sociaux
    const socials = profile.socialLinks || {};
    const socialEmojis = { youtube: '🔴', twitch: '🟣', instagram: '📸', tiktok: '📱' };
    let socialDisplay = Object.entries(socials)
        .filter(([_, link]) => link)
        .map(([platform, link]) => `${socialEmojis[platform]} **${platform.charAt(0).toUpperCase() + platform.slice(1)}**: ${link.includes('http') ? `[Lien](${link})` : `\`${link}\``}`)
        .join('\n');

    if (socialDisplay) {
        embed.addFields({ name: '🌐 Réseaux Sociaux', value: socialDisplay, inline: false });
    }

    // Paramètres de confidentialité (Privacy Mode)
    const privacy = profile.privacy || { showStats: true, showRank: true, showXp: true };
    const isOwner = targetId === interaction.user.id;

    // Informations de rang (respecte la confidentialité)
    if (privacy.showRank || isOwner) {
        embed.addFields({
            name: `${currentGrade.emoji} Grade`,
            value: `**${userData.level}**`,
            inline: true
        });
    }

    if (privacy.showXp || isOwner) {
        embed.addFields({
            name: '✨ XP',
            value: `**${userData.xp || 0}** XP`,
            inline: true
        });
    }

    if ((privacy.showRank || privacy.showXp) || isOwner) {
        embed.addFields({
            name: '📊 Progression',
            value: nextGrade
                ? `\`${progressBar}\` ${progressPercent}%\n➜ ${nextGrade.emoji} ${nextGrade.name}`
                : `\`${progressBar}\` MAX`,
            inline: false
        });
    }

    // Statistiques de jeu (respecte la confidentialité)
    if ((privacy.showStats || isOwner) && gameStats.werewolf) {
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

    // Générer l'image du profil
    let attachment = null;
    try {
        const imageBuffer = await generateProfileCard({
            member: targetMember,
            level: userData.level,
            xp: userData.xp || 0,
            nextLevelXp: nextGrade ? nextGrade.xp : userData.xp,
            currentLevelXp: currentGrade.xp,
            badges: featuredBadges.length > 0 ? featuredBadges : (profile.badges || []).slice(0, 6),
            background: profile.background || 'default',
            accentColor: profile.accentColor || '#febc11',
            bio: profile.bio || '',
            socials: socials
        });
        attachment = new AttachmentBuilder(imageBuffer, { name: `profile_${targetId}.png` });
        embed.setImage(`attachment://profile_${targetId}.png`);
    } catch (e) {
        console.error('[Profile] Erreur génération image:', e);
    }

    embed.setFooter({
        text: `ID: ${targetId} ${!privacy.showStats && !isOwner ? '• Stats masquées 🔒' : ''}`,
        iconURL: interaction.guild.iconURL()
    });
    embed.setTimestamp();

    // Boutons d'action
    const components = [];

    if (targetId === interaction.user.id) {
        const row = new ActionRowBuilder().addComponents(
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
                .setCustomId('profile_edit_color')
                .setLabel('Couleur')
                .setEmoji('🌈')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_edit_title')
                .setLabel('Titre')
                .setEmoji('👑')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(subscription.tier.id === 'free'),
            new ButtonBuilder()
                .setCustomId('profile_view_badges')
                .setLabel('Badges')
                .setEmoji('🏅')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('profile_edit_featured')
                .setLabel('À la Une')
                .setEmoji('✨')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_edit_social')
                .setLabel('Sociaux')
                .setEmoji('🌐')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_edit_banner')
                .setLabel('Bannière')
                .setEmoji('🖼️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(subscription.tier.id !== 'premium_plus'),
            new ButtonBuilder()
                .setCustomId('profile_edit_privacy')
                .setLabel('Privé')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(subscription.tier.id === 'free')
        );

        components.push(row, row2);
    }

    const payload = {
        embeds: [embed],
        components: components
    };

    if (attachment) {
        payload.files = [attachment];
    }

    await interaction.reply(payload);
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

    const options = backgrounds.map(bg => {
        const isUnlocked = isPremium || (profile.unlockedBackgrounds || []).includes(bg.id);
        return {
            label: bg.name,
            value: bg.id,
            description: bg.premium && !isUnlocked ? `⭐ ${bg.price.toLocaleString()} 🪙` : (bg.premium ? 'Premium / Débloqué' : 'Gratuit'),
            emoji: bg.premium && !isUnlocked ? '🔒' : '🎨',
            default: profile.background === bg.id
        };
    });

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
    const subscription = await getUserSubscription(userId);
    const isPremium = subscription.tier.id !== 'free';
    const profile = await getProfile(userId, guildId);
    const hasColorFeature = isPremium || (profile.unlockedFeatures || []).includes('custom_color');

    if (!hasColorFeature) {
        return interaction.reply({
            content: '⭐ Changer ta couleur d\'accent est réservé aux membres **Premium**.\n\n' +
                '💡 Tu peux aussi débloquer cette option définitivement pour **25,000 🪙** via le bouton **"Couleur"** sur ton `/profile` !',
            flags: [64]
        });
    }

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

    const subscription = await getUserSubscription(userId);
    const isPremium = subscription.tier.id !== 'free';
    const profile = await getProfile(userId, guildId);
    const hasTitleFeature = isPremium || (profile.unlockedFeatures || []).includes('custom_title');

    if (!hasTitleFeature) {
        return interaction.reply({
            content: '⭐ Définir un titre personnalisé est réservé aux membres **Premium**.\n\n' +
                '💡 Tu peux aussi débloquer cette option définitivement pour **40,000 🪙** via le bouton **"Titre"** sur ton `/profile` !',
            flags: [64]
        });
    }

    await updateProfile(userId, guildId, { customTitle: title });

    await interaction.reply({
        content: `✅ Ton titre personnalisé a été défini : **${title}**`,
        flags: [64]
    });
}
