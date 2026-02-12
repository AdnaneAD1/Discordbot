const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
                    .setTitle('⭐ OFFRES PREMIUM SIGMA PALACE')
                    .setColor('#f39c12')
                    .setDescription('Débloquez des fonctionnalités exclusives et soutenez le développement du bot !')
                    .addFields(
                        {
                            name: `${SUBSCRIPTION_TIERS.SIGMA_PLAYER.emoji} ${SUBSCRIPTION_TIERS.SIGMA_PLAYER.name}`,
                            value: [
                                `💰 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.price.monthly}€**/mois`,
                                `🏠 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.maxGuilds} serveur** activable`,
                                `📷 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.imagesPerDay} images** AI / jour (HD)`,
                                `✨ **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.imageStyles} styles** artistiques`,
                                `📈 Multiplicateur XP **x${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.xpMultiplier}**`,
                                `🎵 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.maxPlaylists} playlists** musicales`,
                                `🗳️ Poids de vote skip : **x${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.voteSkipWeight}**`,
                                '🖼️ Badges exclusifs & Profil custom'
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: `${SUBSCRIPTION_TIERS.TITAN_SERVER.emoji} ${SUBSCRIPTION_TIERS.TITAN_SERVER.name}`,
                            value: [
                                `💰 **${SUBSCRIPTION_TIERS.TITAN_SERVER.price.monthly}€**/mois`,
                                `🏠 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.maxGuilds} serveurs** activables`,
                                `📸 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.imagesPerDay} images** AI / jour (4K)`,
                                '🎨 **Tous les styles** débloqués',
                                `📈 Multiplicateur XP **x${SUBSCRIPTION_TIERS.TITAN_SERVER.features.xpMultiplier}**`,
                                `🎵 **Playlists illimitées** (max 50)`,
                                '⚡ **Zéro Cooldown** sur les jeux',
                                '📤 **Upload de Background** Profile'
                            ].join('\n'),
                            inline: true
                        }
                    )
                    .setFooter({ text: '💳 Utilisez /buychips pour voir les packs ou s\'abonner !' });

                const guildStatus = await isGuildPremium(guildId);
                if (guildStatus.isPremium) {
                    embed.addFields({
                        name: '📌 État du serveur actuel',
                        value: `✅ Premium activé par <@${guildStatus.sponsor}> (${guildStatus.tier?.name || 'Inconnu'})`
                    });
                }

                return interaction.reply({ embeds: [embed], flags: [64] });
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
