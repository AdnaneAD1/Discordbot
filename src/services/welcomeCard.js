/**
 * Service de génération de cartes de bienvenue personnalisées (Premium)
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Dossier des polices
const FONTS_DIR = path.join(__dirname, '../assets/fonts');

// Polices supportées
const SUPPORTED_FONTS = {
    'Arial': 'Arial, sans-serif',
    'Roboto': 'Roboto, "Segoe UI", sans-serif',
    'Montserrat': 'Montserrat, sans-serif',
    'Open Sans': '"Open Sans", sans-serif',
    'Lato': 'Lato, sans-serif',
    'Poppins': 'Poppins, sans-serif',
    'Oswald': 'Oswald, sans-serif',
    'Raleway': 'Raleway, sans-serif',
    'Nunito': 'Nunito, sans-serif',
    'Bebas Neue': '"Bebas Neue", cursive'
};

// Enregistrement des polices si présentes
if (fs.existsSync(FONTS_DIR)) {
    const files = fs.readdirSync(FONTS_DIR);
    files.forEach(file => {
        if (file.endsWith('.ttf') || file.endsWith('.otf')) {
            const fontName = path.parse(file).name;
            registerFont(path.join(FONTS_DIR, file), { family: fontName });
            console.log(`[WelcomeCard] Police enregistrée : ${fontName}`);
        }
    });
}

// Backgrounds prédéfinis
const BACKGROUNDS = {
    default: {
        id: 'default',
        name: 'Classique',
        color: '#1a1a2e',
        gradient: ['#16213e', '#0f3460'],
        premium: false
    },
    anime: {
        id: 'anime',
        name: 'Anime',
        color: '#ff6b9d',
        gradient: ['#c44569', '#ff6b9d'],
        premium: false
    },
    gaming: {
        id: 'gaming',
        name: 'Gaming',
        color: '#00ff88',
        gradient: ['#0f0f23', '#1a1a3e'],
        accent: '#00ff88',
        premium: false
    },
    nature: {
        id: 'nature',
        name: 'Nature',
        color: '#2d5016',
        gradient: ['#1a3a0f', '#2d5016'],
        premium: false
    },
    custom: {
        id: 'custom',
        name: 'Personnalisé',
        premium: false // Disponible dès Premium (vérifié côté commande)
    }
};

/**
 * Génère une carte de bienvenue personnalisée
 * @param {GuildMember} member - Le membre qui rejoint
 * @param {Object} config - Configuration du welcome
 * @returns {Buffer} - Image PNG
 */
async function generateWelcomeCard(member, config = {}) {
    const width = 1024;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Configuration par défaut
    const settings = {
        backgroundId: config.backgroundId || 'default',
        customBackgroundUrl: config.customBackgroundUrl || null,
        titleText: config.titleText || 'BIENVENUE',
        messageText: config.messageText || 'Bienvenue sur le serveur !',
        textColor: config.textColor || '#FFFFFF',
        accentColor: config.accentColor || '#febc11',
        fontFamily: config.fontFamily || 'Arial'
    };

    const fontFace = SUPPORTED_FONTS[settings.fontFamily] || settings.fontFamily || 'Arial, sans-serif';

    // ===== BACKGROUND =====
    const bgConfig = BACKGROUNDS[settings.backgroundId] || BACKGROUNDS.default;

    if (settings.backgroundId === 'custom' && settings.customBackgroundUrl) {
        try {
            const bgImage = await loadImage(settings.customBackgroundUrl);
            // Couvrir tout le canvas en gardant les proportions
            const scale = Math.max(width / bgImage.width, height / bgImage.height);
            const x = (width - bgImage.width * scale) / 2;
            const y = (height - bgImage.height * scale) / 2;
            ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);

            // Overlay sombre pour la lisibilité
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, width, height);
        } catch (err) {
            console.error('[WelcomeCard] Erreur chargement background custom:', err);
            drawGradientBackground(ctx, width, height, bgConfig.gradient || ['#1a1a2e', '#16213e']);
        }
    } else {
        drawGradientBackground(ctx, width, height, bgConfig.gradient || ['#1a1a2e', '#16213e']);

        // Accent glow pour gaming
        if (settings.backgroundId === 'gaming') {
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 50;
            ctx.strokeStyle = '#00ff8833';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 20, width - 40, height - 40);
            ctx.shadowBlur = 0;
        }
    }

    // ===== AVATAR =====
    const avatarSize = 180;
    const avatarX = width / 2;
    const avatarY = 140;

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);

        // Cercle de bordure
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2 + 8, 0, Math.PI * 2);
        ctx.fillStyle = settings.accentColor;
        ctx.fill();

        // Clip circulaire pour l'avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();
    } catch (err) {
        console.error('[WelcomeCard] Erreur chargement avatar:', err);
        // Placeholder circle
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
    }

    // ===== TITRE (BIENVENUE) =====
    ctx.fillStyle = settings.textColor;
    ctx.font = `bold 56px ${fontFace}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ombre du texte
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(settings.titleText, width / 2, 280);

    // ===== USERNAME =====
    ctx.font = `bold 36px ${fontFace}`;
    ctx.fillStyle = settings.accentColor;
    ctx.fillText(member.user.displayName || member.user.username, width / 2, 330);

    // ===== MESSAGE =====
    ctx.font = `24px ${fontFace}`;
    ctx.fillStyle = settings.textColor;
    ctx.shadowBlur = 5;

    // Remplacer les placeholders
    let message = settings.messageText
        .replace('{user}', member.user.displayName || member.user.username)
        .replace('{server}', member.guild.name);

    ctx.fillText(message, width / 2, 390);

    ctx.shadowBlur = 0;

    return canvas.toBuffer('image/png');
}

/**
 * Dessine un fond dégradé
 */
function drawGradientBackground(ctx, width, height, colors) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Récupère les backgrounds disponibles
 */
function getAvailableBackgrounds() {
    return Object.values(BACKGROUNDS);
}

/**
 * Récupère un background par son ID
 */
function getBackground(id) {
    return BACKGROUNDS[id] || BACKGROUNDS.default;
}

module.exports = {
    generateWelcomeCard,
    getAvailableBackgrounds,
    getBackground,
    BACKGROUNDS
};
