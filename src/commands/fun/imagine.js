const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { validatePrompt } = require('../../utils/contentFilter');
const imageCooldown = require('../../systems/imageCooldown');
const path = require('path');
const fs = require('fs');

// Styles disponibles avec leurs modificateurs de prompt
const STYLES = {
    realistic: 'photorealistic, highly detailed, 8k quality',
    anime: 'anime style, manga art, vibrant colors',
    cartoon: 'cartoon style, colorful, playful',
    'digital-art': 'digital art, concept art, artstation quality',
    'oil-painting': 'oil painting style, classical art, brushstrokes',
    cyberpunk: 'cyberpunk style, neon lights, futuristic',
    fantasy: 'fantasy art, magical, ethereal'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Génère une image à partir d\'une description')
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
                    { name: '✨ Fantasy', value: 'fantasy' }
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
            return interaction.reply({ content: validation.error, ephemeral: true });
        }

        // Vérification du cooldown
        const cooldownCheck = await imageCooldown.checkCooldown(interaction.guild.id, interaction.user.id);
        if (!cooldownCheck.allowed) {
            return interaction.reply({
                content: `⏱️ Tu as atteint la limite de 5 images par jour.\nRéessaye dans **${cooldownCheck.resetIn} heure(s)**.`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ flags: isPrivate ? [64] : [] });

        try {
            // Construction du prompt complet avec le style
            const styleModifier = STYLES[style];
            const fullPrompt = `${prompt}, ${styleModifier}`;

            // Note: Cette partie nécessite une intégration avec une API de génération d'images
            // Pour l'instant, on simule avec un placeholder
            const imagePath = await generateImage(fullPrompt, interaction.user.id);

            // Enregistrement de la génération
            await imageCooldown.recordGeneration(interaction.guild.id, interaction.user.id);

            // Création de l'embed
            const embed = new EmbedBuilder()
                .setTitle('🎨 Image Générée')
                .setDescription(`**Prompt :** ${prompt}`)
                .addFields(
                    { name: 'Style', value: style, inline: true },
                    { name: 'Restant', value: `${cooldownCheck.remaining - 1}/5`, inline: true }
                )
                .setImage(`attachment://generated.png`)
                .setColor('#9b59b6')
                .setFooter({ text: `Demandé par ${interaction.user.username}` })
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

            const attachment = new AttachmentBuilder(imagePath, { name: 'generated.png' });

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
            await interaction.editReply({
                content: `❌ ${error.message || 'Une erreur est survenue lors de la génération de l\'image.'}`,
                flags: [64]
            });
        }
    }
};

// Fonction de génération d'image via Hugging Face API
async function generateImage(prompt, userId) {
    const axios = require('axios');
    const fs = require('fs').promises;
    const path = require('path');

    try {
        // Utilisation de l'API Hugging Face (gratuite avec limite généreuse)
        // Modèle: Stable Diffusion XL
        const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

        if (!HF_API_KEY) {
            throw new Error('Clé API Hugging Face manquante. Ajoute HUGGINGFACE_API_KEY dans ton .env');
        }

        const API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

        const response = await axios.post(API_URL, {
            inputs: prompt
        }, {
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`
            },
            responseType: 'arraybuffer',
            timeout: 120000 // 2 minutes timeout
        });

        // Sauvegarder l'image temporairement
        const tempDir = path.join(__dirname, '..', '..', 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const filename = `generated_${userId}_${Date.now()}.png`;
        const filepath = path.join(tempDir, filename);

        await fs.writeFile(filepath, response.data);

        return filepath;
    } catch (error) {
        // Décoder le message d'erreur si c'est un buffer
        let errorMessage = error.message;
        if (error.response?.data) {
            try {
                const errorData = Buffer.isBuffer(error.response.data)
                    ? JSON.parse(error.response.data.toString())
                    : error.response.data;
                errorMessage = errorData.error || errorData.message || errorMessage;
                console.error('Erreur API Hugging Face:', errorData);
            } catch (parseError) {
                console.error('Erreur génération image (raw):', error.response?.data);
            }
        } else {
            console.error('Erreur génération image:', errorMessage);
        }

        // Si le modèle est en train de charger
        if (error.response?.status === 503) {
            throw new Error('Le modèle est en cours de chargement. Réessaye dans 20 secondes.');
        }

        // Si c'est une erreur d'authentification
        if (error.response?.status === 401 || errorMessage.includes('Invalid token')) {
            throw new Error('Clé API Hugging Face invalide. Vérifie ta clé dans le .env');
        }

        // Si la clé API est manquante
        if (errorMessage.includes('Clé API')) {
            throw error;
        }

        throw new Error(`Impossible de générer l'image: ${errorMessage}`);
    }
}
