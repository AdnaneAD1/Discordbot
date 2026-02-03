const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

async function handleProfileInteraction(interaction) {
    const { customId, values } = interaction;
    const { getProfile, updateProfile, getAllBackgrounds, formatBadges, getAllBadges, RARITY_COLORS, checkAndAwardBadges } = require('../../systems/profiles');
    const { getUserSubscription } = require('../../services/subscriptions');
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
        }
    } else if (interaction.isStringSelectMenu()) {
        if (customId === 'profile_background_select') {
            const selectedBg = values[0];
            const backgrounds = getAllBackgrounds();
            const bgInfo = backgrounds.find(b => b.id === selectedBg);

            if (!bgInfo) return interaction.reply({ content: '❌ Background invalide.', flags: [64] });

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
            await interaction.reply({ content: `✅ Background mis à jour : **${bgInfo.name}**`, flags: [64] });
        }
    } else if (interaction.isModalSubmit()) {
        if (customId === 'profile_bio_modal') {
            const bio = interaction.fields.getTextInputValue('bio_input') || '';
            await updateProfile(userId, guildId, { bio });
            await interaction.reply({
                content: bio ? `✅ Ta bio a été mise à jour :\n*"${bio}"*` : '✅ Ta bio a été supprimée.',
                flags: [64]
            });
        }
    }
}

module.exports = { handleProfileInteraction };
