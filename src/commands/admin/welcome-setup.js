const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { db } = require('../../services/firebase');
const { isGuildPremium } = require('../../services/subscriptions');
const { generateWelcomeCard, getAvailableBackgrounds } = require('../../services/welcomeCard');
const configCache = require('../../services/configCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome-setup')
        .setDescription('Configure les messages de bienvenue (Premium)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Active le mode welcome image premium'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Désactive le mode welcome image (revient à l\'embed classique)'))
        .addSubcommand(sub =>
            sub.setName('background')
                .setDescription('Change le background de l\'image'))
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('Personnalise les textes de l\'image'))
        .addSubcommand(sub =>
            sub.setName('preview')
                .setDescription('Affiche un aperçu de l\'image de bienvenue'))
        .addSubcommand(sub =>
            sub.setName('upload')
                .setDescription('Upload un background personnalisé')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image à utiliser (1024x450 recommandé)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Affiche la configuration actuelle')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        // Vérifier si le serveur est premium
        const premiumStatus = await isGuildPremium(guildId);

        if (!premiumStatus.isPremium && subcommand !== 'status') {
            return interaction.reply({
                content: '⭐ Cette fonctionnalité nécessite un abonnement **Premium**.\nUn membre premium peut activer ses avantages sur ce serveur via `/premium activate`.',
                flags: [64]
            });
        }

        const welcomeRef = db.collection('guilds').doc(guildId).collection('config').doc('welcome');
        const welcomeConfig = (await welcomeRef.get()).data() || {};

        switch (subcommand) {
            case 'enable': {
                await welcomeRef.set({ isPremiumCard: true }, { merge: true });
                configCache.invalidate(guildId, 'welcome');
                return interaction.reply({
                    content: '✅ **Mode Welcome Image activé !**\nLes nouveaux membres verront une image personnalisée.\n\nUtilise `/welcome-setup preview` pour voir le résultat.',
                    flags: [64]
                });
            }

            case 'disable': {
                await welcomeRef.set({ isPremiumCard: false }, { merge: true });
                configCache.invalidate(guildId, 'welcome');
                return interaction.reply({
                    content: '✅ **Mode Welcome Image désactivé.**\nLes nouveaux membres verront l\'embed classique.',
                    flags: [64]
                });
            }

            case 'background': {
                const backgrounds = getAvailableBackgrounds().filter(bg => bg.id !== 'custom');
                const options = backgrounds.map(bg => ({
                    label: bg.name,
                    value: bg.id,
                    description: 'Inclus',
                    default: welcomeConfig.backgroundId === bg.id
                }));

                const select = new StringSelectMenuBuilder()
                    .setCustomId('welcome_background_select')
                    .setPlaceholder('Choisir un background')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(select);
                return interaction.reply({
                    content: '🎨 **Choisis un background pour ton image de bienvenue :**\n\n💡 Pour un background personnalisé, utilise `/welcome-setup upload`.',
                    components: [row],
                    flags: [64]
                });
            }

            case 'message': {
                const modal = new ModalBuilder()
                    .setCustomId('welcome_message_modal')
                    .setTitle('Personnaliser les textes');

                const titleInput = new TextInputBuilder()
                    .setCustomId('welcome_title')
                    .setLabel('Titre (ex: BIENVENUE)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(30)
                    .setRequired(false)
                    .setValue(welcomeConfig.titleText || 'BIENVENUE')
                    .setPlaceholder('BIENVENUE');

                const messageInput = new TextInputBuilder()
                    .setCustomId('welcome_message')
                    .setLabel('Message (placeholders: {user}, {server})')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
                    .setValue(welcomeConfig.messageText || 'Bienvenue sur le serveur !')
                    .setPlaceholder('Bienvenue {user} !');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(messageInput)
                );
                return interaction.showModal(modal);
            }

            case 'preview': {
                await interaction.deferReply({ flags: [64] });
                try {
                    const imageBuffer = await generateWelcomeCard(interaction.member, welcomeConfig);
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome_preview.png' });
                    return interaction.editReply({
                        content: '👀 **Aperçu de l\'image de bienvenue :**',
                        files: [attachment]
                    });
                } catch (error) {
                    console.error('[WelcomeSetup] Erreur preview:', error);
                    return interaction.editReply({
                        content: '❌ Erreur lors de la génération de l\'aperçu.'
                    });
                }
            }

            case 'upload': {
                await interaction.deferReply({ flags: [64] });

                const cloudinary = require('../../services/cloudinary');

                if (!cloudinary.isConfigured()) {
                    return interaction.editReply({
                        content: '❌ Cloudinary n\'est pas configuré. Contacte l\'administrateur du bot.'
                    });
                }

                const attachment = interaction.options.getAttachment('image');

                if (!attachment.contentType?.startsWith('image/')) {
                    return interaction.editReply({
                        content: '❌ Le fichier doit être une image (PNG, JPG, WebP).'
                    });
                }

                if (attachment.size > 8 * 1024 * 1024) {
                    return interaction.editReply({
                        content: '❌ L\'image est trop lourde (max 8 MB).'
                    });
                }

                const result = await cloudinary.uploadFromUrl(
                    attachment.url,
                    'welcome_backgrounds',
                    `guild_${guildId}`
                );

                if (!result.success) {
                    return interaction.editReply({
                        content: `❌ Erreur lors de l'upload : ${result.error}`
                    });
                }

                await welcomeRef.set({
                    backgroundId: 'custom',
                    customBackgroundUrl: result.url
                }, { merge: true });
                configCache.invalidate(guildId, 'welcome');

                return interaction.editReply({
                    content: `✅ **Background personnalisé uploadé !**\n\n🔗 URL : ${result.url}\n\nUtilise \`/welcome-setup preview\` pour voir le résultat.`
                });
            }

            case 'status': {
                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Configuration Welcome')
                    .setColor(premiumStatus.isPremium ? '#f39c12' : '#95a5a6')
                    .addFields(
                        { name: '📌 Statut Premium', value: premiumStatus.isPremium ? `✅ Activé (par <@${premiumStatus.sponsor}>)` : '❌ Non activé', inline: true },
                        { name: '🖼️ Mode Image', value: welcomeConfig.isPremiumCard ? '✅ Activé' : '❌ Désactivé (embed)', inline: true },
                        { name: '🎨 Background', value: welcomeConfig.backgroundId || 'default', inline: true },
                        { name: '📝 Titre', value: welcomeConfig.titleText || 'BIENVENUE', inline: true },
                        { name: '💬 Message', value: welcomeConfig.messageText || 'Bienvenue sur le serveur !', inline: true }
                    );

                if (welcomeConfig.customBackgroundUrl) {
                    embed.setImage(welcomeConfig.customBackgroundUrl);
                }

                return interaction.reply({ embeds: [embed], flags: [64] });
            }
        }
    }
};
