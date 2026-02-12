const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

async function handleProfileInteraction(interaction) {
    const { customId, values } = interaction;
    const { getProfile, updateProfile, getAllBackgrounds, formatBadges, getAllBadges, RARITY_COLORS, checkAndAwardBadges, FEATURES, hasFeature, DEFAULT_BACKGROUNDS } = require('../../systems/profiles');
    const { getUserSubscription } = require('../../services/subscriptions');
    const { Blackjack } = require('../../systems/casino');
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (interaction.isButton()) {
        if (customId === 'profile_edit_bio') {
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
        } else if (customId === 'profile_edit_color') {
            const profile = await getProfile(userId, guildId);
            const subscription = await getUserSubscription(userId);
            const isPremium = subscription.tier.id !== 'free';

            if (!hasFeature(profile, 'custom_color', isPremium)) {
                return showUnlockPrompt(interaction, FEATURES.custom_color);
            }

            const modal = new ModalBuilder()
                .setCustomId('profile_color_modal')
                .setTitle('Changer ta couleur d\'accent');

            const colorInput = new TextInputBuilder()
                .setCustomId('color_input')
                .setLabel('Code Hex (ex: #FF5733)')
                .setStyle(TextInputStyle.Short)
                .setMinLength(7)
                .setMaxLength(7)
                .setPlaceholder('#FFFFFF')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
            await interaction.showModal(modal);
        } else if (customId === 'profile_edit_title') {
            const profile = await getProfile(userId, guildId);
            const subscription = await getUserSubscription(userId);
            const isPremium = subscription.tier.id !== 'free';

            if (!hasFeature(profile, 'custom_title', isPremium)) {
                return showUnlockPrompt(interaction, FEATURES.custom_title);
            }

            const modal = new ModalBuilder()
                .setCustomId('profile_title_modal')
                .setTitle('Définir ton titre personnalisé');

            const titleInput = new TextInputBuilder()
                .setCustomId('title_input')
                .setLabel('Ton titre (max 30 chars)')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(30)
                .setRequired(false)
                .setPlaceholder('Ex: Maître des Loups');

            modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
            await interaction.showModal(modal);
        } else if (customId.startsWith('profile_unlock_')) {
            await handleProfileUnlock(interaction);
        }
    } else if (interaction.isStringSelectMenu()) {
        if (customId === 'profile_background_select') {
            const selectedBg = values[0];
            const backgrounds = getAllBackgrounds();
            const bgInfo = backgrounds.find(b => b.id === selectedBg);

            if (!bgInfo) return interaction.reply({ content: '❌ Background invalide.', flags: [64] });

            if (bgInfo.premium) {
                const subscription = await getUserSubscription(userId);
                const profile = await getProfile(userId, guildId);
                const isPremium = subscription.tier.id !== 'free';
                const isUnlocked = (profile.unlockedBackgrounds || []).includes(selectedBg);

                if (!isPremium && !isUnlocked) {
                    return showUnlockPrompt(interaction, bgInfo, true);
                }
            }

            await updateProfile(userId, guildId, { background: selectedBg });
            await interaction.reply({ content: `✅ Background mis à jour : **${bgInfo.name}**`, flags: [64] });
        } else if (customId === 'profile_featured_select') {
            await updateProfile(userId, guildId, { featuredBadges: values });
            await interaction.reply({ content: `✅ Tes **${values.length}** badges à la une ont été mis à jour !`, flags: [64] });
        } else if (customId === 'profile_privacy_select') {
            const subscription = await getUserSubscription(userId);
            if (subscription.tier.id === 'free') {
                return interaction.reply({ content: '⭐ La confidentialité est réservée aux membres **Premium**.', flags: [64] });
            }

            const privacy = {
                showStats: values.includes('showStats'),
                showRank: values.includes('showRank'),
                showXp: values.includes('showXp')
            };

            await updateProfile(userId, guildId, { privacy });
            await interaction.reply({ content: '✅ Tes paramètres de confidentialité ont été mis à jour !', flags: [64] });
        }
    } else if (interaction.isModalSubmit()) {
        if (customId === 'profile_bio_modal') {
            const bio = interaction.fields.getTextInputValue('bio_input') || '';
            await updateProfile(userId, guildId, { bio });
            await interaction.reply({
                content: bio ? `✅ Ta bio a été mise à jour :\n*"${bio}"*` : '✅ Ta bio a été supprimée.',
                flags: [64]
            });
        } else if (customId === 'profile_color_modal') {
            let color = interaction.fields.getTextInputValue('color_input');
            if (!color.startsWith('#')) color = '#' + color;

            const hexRegex = /^#[0-9A-Fa-f]{6}$/;
            if (!hexRegex.test(color)) {
                return interaction.reply({ content: '❌ Format de couleur invalide (ex: #FF5733).', flags: [64] });
            }

            await updateProfile(userId, guildId, { accentColor: color.toUpperCase() });
            await interaction.reply({ content: `✅ Couleur d'accent mise à jour : **${color.toUpperCase()}**`, flags: [64] });
        } else if (customId === 'profile_title_modal') {
            const title = interaction.fields.getTextInputValue('title_input') || null;
            await updateProfile(userId, guildId, { customTitle: title });
            await interaction.reply({
                content: title ? `✅ Ton titre a été mis à jour : **${title}**` : '✅ Ton titre a été supprimé.',
                flags: [64]
            });
        }
    }
}

async function showUnlockPrompt(interaction, item, isBackground = false) {
    const { Blackjack } = require('../../systems/casino');
    const balance = await Blackjack.getBalance(interaction.user.id);
    const typeLabel = isBackground ? 'le background' : 'la fonctionnalité';
    const premiumEmoji = isBackground ? '🎨' : item.emoji || '✨';

    const embed = new EmbedBuilder()
        .setTitle(`🔒 Débloquer ${item.name}`)
        .setDescription(`Cette option nécessite normalement un abonnement **Premium**.\n\n` +
            `Tu peux cependant la débloquer définitivement pour ton profil avec tes jetons !\n\n` +
            `💰 **Prix :** \`${item.price.toLocaleString()} 🪙\`\n` +
            `🏦 **Ton Solde :** \`${balance.toLocaleString()} 🪙\``)
        .setColor('#f1c40f');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_unlock_${isBackground ? 'bg' : 'feat'}_${item.id}`)
            .setLabel(balance >= item.price ? 'Confirmer l\'achat' : 'Solde insuffisant')
            .setStyle(balance >= item.price ? 3 : 2) // Success (green) or Secondary (grey)
            .setEmoji('🛒')
            .setDisabled(balance < item.price),
        new ButtonBuilder()
            .setCustomId('profile_unlock_cancel')
            .setLabel('Annuler')
            .setStyle(2) // Secondary
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
}

async function handleProfileUnlock(interaction) {
    const { customId, guildId, user } = interaction;
    if (customId === 'profile_unlock_cancel') {
        return interaction.update({ content: '❌ Achat annulé.', embeds: [], components: [] });
    }

    const { getProfile, updateProfile, FEATURES, DEFAULT_BACKGROUNDS } = require('../../systems/profiles');
    const { Blackjack } = require('../../systems/casino');

    const [, , type, itemId] = customId.split('_'); // profile_unlock_feat_custom_color
    const isBackground = type === 'bg';
    const item = isBackground ? DEFAULT_BACKGROUNDS[itemId] : FEATURES[itemId];

    if (!item) return interaction.reply({ content: '❌ Article introuvable.', flags: [64] });

    const balance = await Blackjack.getBalance(user.id);
    if (balance < item.price) {
        return interaction.reply({ content: '❌ Tu n\'as pas assez de jetons !', flags: [64] });
    }

    const profile = await getProfile(user.id, guildId);

    if (isBackground) {
        const unlockedBackgrounds = profile.unlockedBackgrounds || [];
        if (!unlockedBackgrounds.includes(itemId)) unlockedBackgrounds.push(itemId);
        await updateProfile(user.id, guildId, { unlockedBackgrounds, background: itemId });
    } else {
        const unlockedFeatures = profile.unlockedFeatures || [];
        if (!unlockedFeatures.includes(itemId)) unlockedFeatures.push(itemId);
        await updateProfile(user.id, guildId, { unlockedFeatures });
    }

    await Blackjack.updateBalance(user.id, -item.price);

    await interaction.update({
        content: `🎉 **Félicitations !** Tu as débloqué **${item.name}** pour \`${item.price.toLocaleString()} 🪙\`.`,
        embeds: [],
        components: []
    });
}

module.exports = { handleProfileInteraction };
