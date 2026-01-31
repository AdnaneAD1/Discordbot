const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { validatePrompt } = require('../../utils/contentFilter');
const imageCooldown = require('../../systems/imageCooldown');
const { generateImage, getAllStyles, getStyleInfo } = require('../../services/imageGeneration');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Génère une image à partir d\'une description (propulsé par Nano Banana & HF)')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Description de l\'image à générer')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Style artistique de l\'image')
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
        if (!cooldownCheck.allowed) {
            return interaction.reply({
                content: `⏱️ Tu as atteint la limite de 5 images par jour.\nRéessaye dans **${cooldownCheck.resetIn}**.`,
                flags: [64]
            });
        }

        await interaction.deferReply({ flags: isPrivate ? [64] : [] });

        try {
            // Génération de l'image avec le nouveau service
            const result = await generateImage(prompt, {
                style,
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                premium: false
            });

            // Enregistrement de la génération
            await imageCooldown.recordGeneration(interaction.guild.id, interaction.user.id);

            // Récupérer les infos du style
            const styleInfo = getStyleInfo(style);

            // Création de l'embed
            const embed = new EmbedBuilder()
                .setTitle('🎨 Image Générée')
                .setDescription(`**Prompt :** ${prompt}`)
                .addFields(
                    { name: 'Style', value: `${styleInfo?.emoji || '🎨'} ${styleInfo?.name || style}`, inline: true },
                    { name: 'Restant', value: `${cooldownCheck.remaining - 1}/5`, inline: true },
                    { name: 'Provider', value: result.providerName, inline: true }
                )
                .setImage('attachment://generated.png')
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

            const attachment = new AttachmentBuilder(result.filepath, { name: 'generated.png' });

            await interaction.editReply({
                embeds: [embed],
                files: [attachment],
                components: [row]
            });

            // Stocker les données pour la régénération
            interaction.client.imageCache = interaction.client.imageCache || new Map();
            interaction.client.imageCache.set(interaction.user.id, { prompt, style });

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
