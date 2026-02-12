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
                    .setColor('#f1c40f')
                    .setDescription(
                        'Débloque la puissance maximale de **Sigma Palace** et accède à des fonctionnalités exclusives ! 💎\n\n' +
                        '**Pourquoi passer au Premium ?**\n' +
                        '✨ **Qualité Supérieure** : Modèles IA 4K et audio Ultra-HD.\n' +
                        '⚡ **Vitesse Totale** : Suppression des délais (No Cooldown).\n' +
                        '🎁 **Avantages Casino** : Cashback automatique sur tes pertes.\n' +
                        '🎨 **Identité Unique** : Bannières personnalisées et badges exclusifs.'
                    )
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2641/2641433.png')
                    .addFields(
                        {
                            name: `\u200b\n${SUBSCRIPTION_TIERS.SIGMA_PLAYER.emoji} ${SUBSCRIPTION_TIERS.SIGMA_PLAYER.name.toUpperCase()}`,
                            value: [
                                `> **Prix :** \`${SUBSCRIPTION_TIERS.SIGMA_PLAYER.price.monthly}€/mois\``,
                                `🔹 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.maxGuilds} Serveur** Boosté`,
                                `📸 **${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.imagesPerDay}** Images IA / jour (HD)`,
                                `📈 Multiplicateur XP **x${SUBSCRIPTION_TIERS.SIGMA_PLAYER.features.xpMultiplier}**`,
                                `💸 Cashback Casino **10%**`,
                                `🎵 **Skip Gratuit** & Audio High Quality`
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: `\u200b\n${SUBSCRIPTION_TIERS.TITAN_SERVER.emoji} ${SUBSCRIPTION_TIERS.TITAN_SERVER.name.toUpperCase()}`,
                            value: [
                                `> **Prix :** \`${SUBSCRIPTION_TIERS.TITAN_SERVER.price.monthly}€/mois\``,
                                `🔹 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.maxGuilds} Serveurs** Boostés`,
                                `📸 **${SUBSCRIPTION_TIERS.TITAN_SERVER.features.imagesPerDay}** Images IA / jour (4K)`,
                                `⚡ **AUCUN COOLDOWN** sur les images`,
                                `📤 **Background Custom** (Upload)`,
                                `👑 Badge exclusif **TITAN**`
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: '\u200b\n📊 TABLEAU COMPARATIF',
                            value: [
                                '```prolog',
                                'FONCTIONNALITÉ      | GRATUIT | SIGMA | TITAN',
                                '--------------------+---------+-------+-------',
                                'Images / Jour       |    5    |   25  |  250  ',
                                'Qualité Max         |   SD    |   HD  |  4K   ',
                                'Styles IA           |    3    |   15  |  MAX  ',
                                'Cooldown Image      |   Oui   |  Oui  |  NON  ',
                                'Calculateur XP      |   x1    | x1.5  |  x2   ',
                                'Cashback Casino     |   0%    |  10%  |  10%  ',
                                'Frais de Skip 🎵    |  100🪙  |  Offert |  Offert',
                                'Background Profil   |  Défaut | Défaut| CUSTOM',
                                '```'
                            ].join('\n'),
                            inline: false
                        }
                    )
                    .setFooter({ text: '🛒 Tape /buychips pour t\'abonner instantanément !' })
                    .setTimestamp();

                const shopButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('🛍️ Ouvrir la Boutique')
                        .setCustomId('open_shop_from_info')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setLabel('❓ Aide Support')
                        .setURL('https://discord.gg/sigmapalace') // Exemple
                        .setStyle(ButtonStyle.Link)
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
