const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { validatePrompt } = require('../../utils/contentFilter');
const imageCooldown = require('../../systems/imageCooldown');
const { generateImage, modifyImage, getAllStyles, getStyleInfo } = require('../../services/imageGeneration');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Génère ou modifie une image via IA')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Description de l\'image (ou instruction de modification)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Style artistique (Uniquement pour la génération)')
                .setRequired(false)
                .addChoices(
                    { name: '📸 Réaliste', value: 'realistic' },
                    { name: '🎌 Anime', value: 'anime' },
                    { name: '🎨 Cartoon', value: 'cartoon' },
                    { name: '💻 Digital Art', value: 'digital-art' },
                    { name: '🖼️ Peinture à l\'huile', value: 'oil-painting' },
                    { name: '🌃 Cyberpunk', value: 'cyberpunk' },
                    { name: '✨ Fantasy', value: 'fantasy' },
                    { name: '👾 Pixel Art', value: 'pixel-art' },
                    { name: '🎨 Aquarelle', value: 'watercolor' },
                    { name: '🎮 3D Render', value: '3d-render' },
                    { name: '⬜ Minimaliste', value: 'minimalist' },
                    { name: '👤 Portrait', value: 'portrait' }
                ))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Recevoir l\'image en privé')
                .setRequired(false)),

    async execute(interaction) {
        const prompt = interaction.options.getString('prompt');
        const style = interaction.options.getString('style') || 'realistic';
        const isPrivate = interaction.options.getBoolean('private') || false;

        // Validation du prompt
        const validation = validatePrompt(prompt);
        if (!validation.valid) {
            return interaction.reply({ content: validation.error, flags: [64] });
        }

        // Vérification du cooldown
        const cooldownCheck = await imageCooldown.checkCooldown(interaction.guild.id, interaction.user.id);

        let cost = 0;
        const maxImages = cooldownCheck.maxImages || 5;

        if (!cooldownCheck.allowed) {
            // Limite atteinte : Proposer de payer
            const { Blackjack } = require('../../systems/casino');
            const balance = await Blackjack.getBalance(interaction.user.id);
            const PRICE_PER_IMAGE = 500;

            if (balance < PRICE_PER_IMAGE) {
                return interaction.reply({
                    content: `⏱️ **Limite atteinte (${maxImages}/${maxImages})** et pas assez de jetons pour continuer.\nIl te faut **${PRICE_PER_IMAGE}** 🪙 pour générer une image supplémentaire (Solde: ${balance}).`,
                    flags: [64]
                });
            }

            // Demander confirmation de paiement
            const payRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('imagine_pay')
                    .setLabel(`Payer ${PRICE_PER_IMAGE} 🪙 pour générer`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💎')
            );

            const msg = await interaction.reply({
                content: `⏱️ **Limite quotidienne atteinte (${maxImages}/${maxImages}).**\nVeux-tu dépenser **${PRICE_PER_IMAGE}** jetons pour générer cette image quand même ?`,
                components: [payRow],
                fetchReply: true,
                flags: [64]
            });

            try {
                const confirmation = await msg.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id && i.customId === 'imagine_pay',
                    time: 30000
                });

                // Paiement accepté
                await Blackjack.updateBalance(interaction.user.id, -PRICE_PER_IMAGE);
                cost = PRICE_PER_IMAGE;
                await confirmation.update({ content: `✅ **Paiement validé !** Génération en cours... (-${PRICE_PER_IMAGE} 🪙)`, components: [] });
            } catch (e) {
                return interaction.editReply({ content: '❌ Temps écoulé ou annulé.', components: [] });
            }
        } else {
            await interaction.deferReply({ flags: isPrivate ? [64] : [] });
        }

        try {
            let result;

            // Mode Génération (Txt2Img)
            result = await generateImage(prompt, {
                style,
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                premium: cooldownCheck.isPremium || false,
                quality: (await require('../../services/subscriptions').getUserSubscription(interaction.user.id)).tier.features.imageQuality
            });

            // Enregistrement de la génération
            await imageCooldown.recordGeneration(interaction.guild.id, interaction.user.id);

            // Téléverser l'image sur Cloudinary si configuré
            const { isConfigured, uploadImage } = require('../../services/cloudinary');
            let cloudinaryUrl = null;
            if (isConfigured()) {
                const uploadResult = await uploadImage(result.filepath, 'ai_images');
                if (uploadResult.success) {
                    cloudinaryUrl = uploadResult.url;
                }
            }

            // Enregistrer dans la galerie Firestore
            if (cloudinaryUrl) {
                await db.collection('ai_gallery').add({
                    prompt,
                    style,
                    imageUrl: cloudinaryUrl,
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    guildId: interaction.guild.id,
                    createdAt: new Date()
                }).catch(console.error);
            }

            // Récupérer les infos du style
            const styleInfo = getStyleInfo(style);

            // Création de l'embed
            const embed = new EmbedBuilder()
                .setTitle('🎨 Image Générée')
                .setDescription(`**Prompt :** ${prompt}`)
                .addFields(
                    { name: 'Mode', value: 'Génération (Txt2Img)', inline: true },
                    { name: 'Coût', value: cost > 0 ? `**${cost}** 🪙` : `${maxImages - (cooldownCheck.remaining - 1)}/${maxImages} (Gratuit)`, inline: true },
                    { name: 'Provider', value: result.providerName, inline: true }
                )
                .setImage(cloudinaryUrl || 'attachment://generated.png')
                .setColor('#9b59b6')
                .setFooter({ text: `Demandé par ${interaction.user.username} • Propulsé par ${result.providerName}` })
                .setTimestamp();

            // Boutons d'action
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`imagine_regenerate_${interaction.user.id}_${Date.now()}`)
                        .setLabel('Régénérer')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`imagine_delete_${interaction.user.id}`)
                        .setLabel('Supprimer')
                        .setEmoji('🗑️')
                        .setStyle(ButtonStyle.Danger)
                );

            const files = [];
            if (!cloudinaryUrl) {
                files.push(new AttachmentBuilder(result.filepath, { name: 'generated.png' }));
            }

            await interaction.editReply({
                content: '', // Reset text content
                embeds: [embed],
                files: files,
                components: [row]
            });

            // Stocker les données pour la régénération
            interaction.client.imageCache = interaction.client.imageCache || new Map();
            interaction.client.imageCache.set(interaction.user.id, {
                prompt,
                style
            });

        } catch (error) {
            console.error('Erreur lors de la génération:', error);

            let errorMessage = '❌ Une erreur est survenue lors de la génération de l\'image.';

            if (error.message.includes('401') || error.message.includes('Invalid token')) {
                errorMessage = '❌ Erreur d\'authentification API. Contactez un administrateur.';
            } else if (error.message.includes('503') || error.message.includes('loading')) {
                errorMessage = '⏳ Le modèle est en cours de chargement. Réessayez dans 20 secondes.';
            } else if (error.message.includes('indisponibles')) {
                errorMessage = '❌ Tous les services de génération d\'images sont temporairement indisponibles. Réessayez plus tard.';
            }

            await interaction.editReply({
                content: errorMessage,
                embeds: [],
                files: [],
                components: []
            });
        }
    }
};
