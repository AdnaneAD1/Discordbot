/**
 * Service de génération de cartes de profil visuelles
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

// Enregistrement des polices si présentes
if (fs.existsSync(FONTS_DIR)) {
    const files = fs.readdirSync(FONTS_DIR);
    files.forEach(file => {
        if (file.endsWith('.ttf') || file.endsWith('.otf')) {
            const fontName = path.parse(file).name;
            registerFont(path.join(FONTS_DIR, file), { family: fontName });
        }
    });
}

/**
 * Génère une carte de profil
 * @param {Object} data - Données du profil (user, xp, level, badges, background, colors)
 * @returns {Buffer} - Image PNG
 */
async function generateProfileCard(data) {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const {
        member,
        level,
        xp,
        nextLevelXp,
        currentLevelXp,
        rank,
        badges = [],
        background = 'default',
        accentColor = '#febc11',
        bio = '',
        socials = {}
    } = data;

    // 1. BACKGROUND
    await drawBackground(ctx, width, height, background);

    // 2. OVERLAY / CARD BODY
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    drawRoundRect(ctx, 20, 20, width - 40, height - 40, 20);
    ctx.fill();

    // Bordure d'accent
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 20, 20, width - 40, height - 40, 20);
    ctx.stroke();

    // 3. AVATAR
    const avatarX = 100;
    const avatarY = height / 2 - 40;
    const avatarSize = 140;

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);

        // Cercle de bordure avatar
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
    }

    // 4. TEXTES (NOM, TITRE, BIO)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';

    // Username
    ctx.font = 'bold 32px Arial';
    ctx.fillText(member.user.username, 200, 100);

    // Titre/Grade
    ctx.font = '24px Arial';
    ctx.fillStyle = accentColor;
    ctx.fillText(level || 'Recrue', 200, 135);

    // Bio
    ctx.font = 'italic 18px Arial';
    ctx.fillStyle = '#AAAAAA';
    const wrappedBio = wrapText(ctx, bio || 'Aucune bio définie', 550);
    wrappedBio.forEach((line, i) => {
        if (i < 2) ctx.fillText(line, 200, 165 + (i * 22));
    });

    // 5. PROGRESS BAR (XP)
    const barX = 200;
    const barY = 250;
    const barWidth = 550;
    const barHeight = 25;

    // Fond de la barre
    ctx.fillStyle = '#333';
    drawRoundRect(ctx, barX, barY, barWidth, barHeight, 12);
    ctx.fill();

    // Progression
    const progress = Math.min(1, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp || 1));
    ctx.fillStyle = accentColor;
    drawRoundRect(ctx, barX, barY, barWidth * progress, barHeight, 12);
    ctx.fill();

    // Stats XP
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`${xp} / ${nextLevelXp} XP`, barX + barWidth / 2, barY + 17);

    // 6. BADGES (A la une)
    ctx.textAlign = 'left';
    let badgeX = 200;
    const badgeYBuffer = 310;

    // On dessine les badges un par un (on utilise des images si possible, ici simulation avec texte/cercle pour MVP)
    // Idéalement on chargerait les emojis, mais ici on va juste faire des cercles colorés ou icônes simples
    for (let i = 0; i < Math.min(badges.length, 6); i++) {
        ctx.beginPath();
        ctx.arc(badgeX + (i * 45), badgeYBuffer, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();
        ctx.font = '20px Arial';
        ctx.fillText('🏅', badgeX + (i * 45) - 10, badgeYBuffer + 7);
    }

    // 7. SOCIALS (Affiche des icônes simples ou texte)
    let socialX = 200;
    const socialY = 195;
    const socialEmojis = { youtube: '🔴', twitch: '🟣', instagram: '📸', tiktok: '📱' };

    ctx.font = '16px Arial';
    ctx.textAlign = 'left';

    Object.entries(socials).forEach(([platform, link], i) => {
        if (link && i < 4) {
            const emoji = socialEmojis[platform] || '🌐';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`${emoji} ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, socialX, socialY);
            socialX += 140;
        }
    });

    return canvas.toBuffer('image/png');
}

async function drawBackground(ctx, width, height, backgroundId) {
    // Liste des dégradés matching profiles.js
    const gradients = {
        default: ['#2b2d31', '#1e1f22'],
        gradient_blue: ['#667eea', '#764ba2'],
        gradient_sunset: ['#f093fb', '#f5576c'],
        gradient_ocean: ['#4facfe', '#00f2fe'],
        gradient_fire: ['#f5af19', '#f12711'],
        gradient_forest: ['#134e5e', '#71b280'],
        gradient_night: ['#00c9ff', '#92fe9d'],
        gradient_aurora: ['#0f0c29', '#302b63'],
        gradient_codm: ['#febc11', '#c99800']
    };

    const colors = gradients[backgroundId] || gradients.default;
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

module.exports = { generateProfileCard };
