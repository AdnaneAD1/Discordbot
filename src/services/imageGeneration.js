/**
 * Service de génération d'images IA
 * Supporte Pollinations.ai (gratuit) et Hugging Face comme fallback
 */

const fs = require('fs').promises;
const path = require('path');

// Providers disponibles
const PROVIDERS = {
    POLLINATIONS: 'pollinations',
    HUGGINGFACE: 'huggingface'
};

// Configuration des providers
const providerConfig = {
    [PROVIDERS.POLLINATIONS]: {
        name: 'Pollinations AI',
        url: 'https://image.pollinations.ai/prompt/',
        priority: 1,
        enabled: true
    },
    [PROVIDERS.HUGGINGFACE]: {
        name: 'Hugging Face',
        url: 'https://router.huggingface.co/nscale/v1/images/generations',
        priority: 2,
        enabled: true
    }
};

// Styles disponibles avec leurs modificateurs de prompt
const STYLES = {
    realistic: {
        name: 'Réaliste',
        emoji: '📸',
        modifier: 'photorealistic, highly detailed, 8k quality, professional photography'
    },
    anime: {
        name: 'Anime',
        emoji: '🎌',
        modifier: 'anime style, manga art, vibrant colors, detailed anime illustration'
    },
    cartoon: {
        name: 'Cartoon',
        emoji: '🎨',
        modifier: 'cartoon style, colorful, playful, Disney-Pixar style'
    },
    'digital-art': {
        name: 'Digital Art',
        emoji: '💻',
        modifier: 'digital art, concept art, artstation quality, trending on artstation'
    },
    'oil-painting': {
        name: 'Peinture à l\'huile',
        emoji: '🖼️',
        modifier: 'oil painting style, classical art, brushstrokes, museum quality'
    },
    cyberpunk: {
        name: 'Cyberpunk',
        emoji: '🌃',
        modifier: 'cyberpunk style, neon lights, futuristic, blade runner aesthetic'
    },
    fantasy: {
        name: 'Fantasy',
        emoji: '✨',
        modifier: 'fantasy art, magical, ethereal, epic fantasy illustration'
    },
    'pixel-art': {
        name: 'Pixel Art',
        emoji: '👾',
        modifier: 'pixel art, 16-bit style, retro gaming aesthetic, pixelated'
    },
    watercolor: {
        name: 'Aquarelle',
        emoji: '🎨',
        modifier: 'watercolor painting, soft colors, artistic, delicate brushwork'
    },
    '3d-render': {
        name: '3D Render',
        emoji: '🎮',
        modifier: '3D render, Blender, Unreal Engine, octane render, high quality 3D'
    },
    minimalist: {
        name: 'Minimaliste',
        emoji: '⬜',
        modifier: 'minimalist design, clean lines, simple shapes, modern aesthetic'
    },
    portrait: {
        name: 'Portrait',
        emoji: '👤',
        modifier: 'professional portrait, studio lighting, sharp focus, detailed face'
    }
};

/**
 * Génère une image via Pollinations.ai (100% gratuit, pas de clé API)
 * Documentation: https://pollinations.ai
 */
async function generateWithPollinations(prompt, options = {}) {
    try {
        // Pollinations utilise une URL GET simple avec le prompt encodé
        const encodedPrompt = encodeURIComponent(prompt);
        const width = options.width || 1024;
        const height = options.height || 1024;

        // Paramètres optionnels: model, width, height, seed, nologo
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

        console.log(`[Pollinations] Génération en cours...`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'image/png,image/*'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // L'API retourne directement l'image en binaire
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 1000) {
            throw new Error('Image reçue trop petite, génération probable échouée');
        }

        return {
            success: true,
            provider: PROVIDERS.POLLINATIONS,
            image: buffer
        };
    } catch (error) {
        console.error('[Pollinations] Erreur:', error.message);
        return { success: false, error: error.message };
    }
}


/**
 * Génère une image via Hugging Face
 */
async function generateWithHuggingFace(prompt, options = {}) {
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

    if (!HF_API_KEY) {
        return { success: false, error: 'Clé API Hugging Face non configurée' };
    }

    try {
        const response = await fetch(providerConfig[PROVIDERS.HUGGINGFACE].url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                model: 'black-forest-labs/FLUX.1-schnell',
                response_format: 'b64_json'
            })
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorData.error || errorMsg;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const result = await response.json();
        const b64Image = result.data?.[0]?.b64_json;

        if (b64Image) {
            return {
                success: true,
                provider: PROVIDERS.HUGGINGFACE,
                image: Buffer.from(b64Image, 'base64')
            };
        }

        throw new Error('Aucune image reçue de Hugging Face');
    } catch (error) {
        console.error('[HuggingFace] Erreur:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Génère une image avec fallback automatique entre providers
 */
async function generateImage(prompt, options = {}) {
    const { style = 'realistic', userId, guildId, premium = false } = options;

    // Appliquer le style au prompt
    const styleConfig = STYLES[style] || STYLES.realistic;
    const fullPrompt = `${prompt}, ${styleConfig.modifier}`;

    // Ordre des providers selon la priorité
    const providers = Object.entries(providerConfig)
        .filter(([_, config]) => config.enabled)
        .sort((a, b) => a[1].priority - b[1].priority);

    let lastError = null;

    for (const [providerId, config] of providers) {
        console.log(`[ImageGen] Tentative avec ${config.name}...`);

        let result;
        switch (providerId) {
            case PROVIDERS.POLLINATIONS:
                result = await generateWithPollinations(fullPrompt, options);
                break;

            case PROVIDERS.HUGGINGFACE:
                result = await generateWithHuggingFace(fullPrompt, options);
                break;
        }

        if (result.success) {
            // Sauvegarder l'image temporairement
            const tempDir = path.join(__dirname, '..', 'temp');
            await fs.mkdir(tempDir, { recursive: true });

            const filename = `generated_${userId}_${Date.now()}.png`;
            const filepath = path.join(tempDir, filename);

            await fs.writeFile(filepath, result.image);

            return {
                success: true,
                filepath,
                provider: result.provider,
                providerName: config.name,
                style: styleConfig.name
            };
        }

        lastError = result.error;
    }

    // Tous les providers ont échoué
    throw new Error(lastError || 'Tous les services de génération sont indisponibles');
}

/**
 * Nettoie les images temporaires anciennes (>1 heure)
 */
async function cleanupTempImages() {
    const tempDir = path.join(__dirname, '..', 'temp');
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    try {
        const files = await fs.readdir(tempDir);

        for (const file of files) {
            if (file.startsWith('generated_')) {
                const filepath = path.join(tempDir, file);
                const stats = await fs.stat(filepath);

                if (stats.mtimeMs < oneHourAgo) {
                    await fs.unlink(filepath);
                    console.log(`[ImageGen] Nettoyé: ${file}`);
                }
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[ImageGen] Erreur nettoyage:', error.message);
        }
    }
}

/**
 * Obtient les informations sur un style
 */
function getStyleInfo(styleId) {
    return STYLES[styleId] || null;
}

/**
 * Obtient tous les styles disponibles
 */
function getAllStyles() {
    return Object.entries(STYLES).map(([id, config]) => ({
        id,
        name: config.name,
        emoji: config.emoji
    }));
}

/**
 * Vérifie le statut des providers
 */
async function getProvidersStatus() {
    const status = {};

    for (const [id, config] of Object.entries(providerConfig)) {
        status[id] = {
            name: config.name,
            enabled: config.enabled,
            priority: config.priority
        };
    }

    return status;
}

// Nettoyage périodique des images temporaires (toutes les 30 minutes)
setInterval(cleanupTempImages, 30 * 60 * 1000);

module.exports = {
    generateImage,
    getStyleInfo,
    getAllStyles,
    getProvidersStatus,
    cleanupTempImages,
    STYLES,
    PROVIDERS
};
