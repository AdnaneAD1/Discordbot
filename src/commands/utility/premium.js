const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUserSubscription, activateGuild, deactivateGuild, getActiveGuilds, isGuildPremium, SUBSCRIPTION_TIERS } = require('../../services/subscriptions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Gère ton abonnement Premium')
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Affiche ton abonnement et tes serveurs activés'))
        .addSubcommand(sub =>
            sub.setName('activate')
                .setDescription('Active le premium sur ce serveur'))
        .addSubcommand(sub =>
            sub.setName('deactivate')
                .setDescription('Désactive le premium sur ce serveur'))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Affiche les informations sur les offres Premium'))
        .addSubcommand(sub =>
            sub.setName('transfer')
                .setDescription('Transfère le premium d\'un serveur à un autre')
                .addStringOption(option => option.setName('from').setDescription('ID du serveur source').setRequired(true))
                .addStringOption(option => option.setName('to').setDescription('ID du serveur de destination').setRequired(true))),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'status': {
                const subscription = await getUserSubscription(userId);
                const activeGuilds = await getActiveGuilds(userId);

                const embed = new EmbedBuilder()
                    .setTitle('⭐ Ton Abonnement Premium')
                    .setColor(subscription.tier.color || '#95a5a6');

                if (subscription.isActive) {
                    const expiresTimestamp = Math.floor(subscription.expiresAt.getTime() / 1000);

                    embed.addFields(
                        { name: '📌 Plan', value: `${subscription.tier.emoji} **${subscription.tier.name}**`, inline: true },
                        { name: '📅 Expire', value: `<t:${expiresTimestamp}:R>`, inline: true },
                        { name: '🔄 Cycle', value: subscription.billingCycle === 'yearly' ? 'Annuel' : 'Mensuel', inline: true }
                    );

                    const maxGuilds = subscription.tier.features.maxGuilds || 1;
                    let serversText = activeGuilds.length > 0
                        ? activeGuilds.map((id, i) => `${i + 1}. \`${id}\``).join('\n')
                        : '*Aucun serveur activé*';

                    embed.addFields({
                        name: `🏠 Serveurs activés (${activeGuilds.length}/${maxGuilds})`,
                        value: serversText
                    });
                } else {
                    embed.setDescription('Tu n\'as pas d\'abonnement actif.\n\nUtilise `/premium info` pour découvrir les offres !');
                }

                return interaction.reply({ embeds: [embed], flags: [64] });
            }

            case 'activate': {
                const subscription = await getUserSubscription(userId);

                if (!subscription.isActive || subscription.tier.id === 'free') {
                    return interaction.reply({
                        content: '❌ Tu n\'as pas d\'abonnement Premium actif.\n\nUtilise `/premium info` pour découvrir les offres !',
                        flags: [64]
                    });
                }

                const result = await activateGuild(userId, guildId);

                if (!result.success) {
                    return interaction.reply({
                        content: `❌ ${result.error}`,
                        flags: [64]
                    });
                }

                return interaction.reply({
                    content: `✅ **Premium activé sur ce serveur !**\n\n${subscription.tier.emoji} Les fonctionnalités **${subscription.tier.name}** sont maintenant disponibles ici.\n\n💡 Les admins peuvent utiliser \`/welcome-setup\` pour configurer les images de bienvenue.`,
                    flags: [64]
                });
            }

            case 'deactivate': {
                const result = await deactivateGuild(userId, guildId);

                if (!result.success) {
                    return interaction.reply({
                        content: `❌ ${result.error}`,
                        flags: [64]
                    });
                }

                return interaction.reply({
                    content: '✅ **Premium désactivé sur ce serveur.**\n\nTu peux maintenant l\'activer sur un autre serveur.',
                    flags: [64]
                });
            }

            case 'info': {

                const embed = new EmbedBuilder()
                    .setTitle('🚀 ÉLÈVE TON SERVEUR AU NIVEAU SUPÉRIEUR')
                    .setColor('#f39c12')
                    .setDescription('Débloque la puissance maximale du bot et soutiens le projet ! 💎\n\n' +
                        '**Pourquoi devenir Premium ?**\n' +
                        '✅ Accès aux modèles IA haute performance (4K).\n' +
                        '✅ Suppression des délais d\'attente (No Cooldown).\n' +
                        '✅ Musique haute fidélité sans frais de skip.\n' +
                        '✅ Personnalisation complète de ton profil.')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2641/2641433.png')
                    .setImage('https://images-ext-1.discordapp.net/external/vL8Yv8z9t9H9oGfT5q9w4m-Uj9h9Z2Xf7Y1p8O0L0M8/https/i.imgur.com/8Q9Z4QY.png') // Placeholder for a cool banner if available, or just a nice separator
                    .addFields(
                        {
                            name: `💎 ${SUBSCRIPTION_TIERS.SIGMA_PLAYER.name.toUpperCase()}`,
                            value: [
                                `> **Prix :** \`${SUBSCRIPTION_TIERS.SIGMA_PLAYER.price.monthly}€/mois\``,
                                `🏠 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.maxGuilds} Serveur** Boosté`,
                                `📸 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.imagesPerDay}** Images IA / jour`,
                                `✨ Qualité **HD** & **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.imageStyles}** Styles`,
                                `📈 Multiplicateur XP **x${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.xpMultiplier}**`,
                                `🛡️ Cashback Casino **10%**`
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: `👑 ${SUBSCRIPTION_TIERS.TITAN_SERVER.name.toUpperCase()}`,
                            value: [
                                `> **Prix :** \`${SUBSCRIPTION_TIERS.TITAN_SERVER.price.monthly}€/mois\``,
                                `🏠 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.maxGuilds} Serveurs** Boostés`,
                                `📸 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.imagesPerDay}** Images IA / jour`,
                                '🎨 Styles **ILLIMITÉS** & Qualité **4K**',
                                `⚡ **Zéro Cooldown** & **Skip Gratuit**`,
                                '📤 **Background Custom** (Upload)'
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: '📸 IMAGES & CRÉATIVITÉ',
                            value: [
                                '└ Images / Jour | `5` | `25` | `500`',
                                '└ Qualité Max | `SD` | `HD` | `4K`',
                                '└ Styles d\'art | `3` | `15` | `MAX`',
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: '🎲 CASINO & JEUX',
                            value: [
                                '└ Cashback Perte | `❌` | `10%` | `10%`',
                                '└ Cooldowns | `Stand.` | `Stand.` | `ZÉRO`',
                                '└ Multiplicateur XP | `x1` | `x1.5` | `x2.0`',
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: '🎵 MUSIQUE & CONFORT',
                            value: [
                                '└ Frais de Skip | `100🪙` | `GRATUIT` | `GRATUIT`',
                                '└ Audio Quality | `Stand.` | `HIGH` | `ULTRA`',
                                '└ Back. Profil | `ST.` | `ST.` | `UPLOAD`',
                            ].join('\n'),
                            inline: false
                        }
                    )
                    .setFooter({ text: '💡 Utilise /buychips pour t\'abonner instantanément !' });

                const shopButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('🛍️ Accéder à la Boutique')
                        .setCustomId('open_shop_from_info')
                        .setStyle(ButtonStyle.Success)
                );

                const guildStatus = await isGuildPremium(guildId);
                if (guildStatus.isPremium) {
                    embed.addFields({
                        name: '📌 ÉTAT DU SERVEUR',
                        value: `✅ Ce serveur bénéficie déjà du **${guildStatus.tier?.name || 'Premium'}** ! (Activé par <@${guildStatus.sponsor}>)`
                    });
                }

                return interaction.reply({ embeds: [embed], components: [shopButton], flags: [64] });
            }

            case 'transfer': {
                const fromId = interaction.options.getString('from');
                const toId = interaction.options.getString('to');
                const { transferGuild } = require('../../services/subscriptions');

                const result = await transferGuild(userId, fromId, toId);

                if (!result.success) {
                    return interaction.reply({
                        content: `❌ ${result.error}`,
                        flags: [64]
                    });
                }

                return interaction.reply({
                    content: `✅ **Transfert réussi !**\nLe Premium a été déplacé du serveur \`${fromId}\` vers le serveur \`${toId}\`.`,
                    flags: [64]
                });
            }
        }
    }
};
