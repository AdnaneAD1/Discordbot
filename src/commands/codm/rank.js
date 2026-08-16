const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const { CODM_GRADES, getBufferedXP } = require('../../systems/xp');
const { createCanvas, loadImage } = require('canvas');

const gradesCache = new Map(); // guildId -> grades

// Dessine un rectangle arrondi pour la compatibilité avec toutes les versions de node-canvas
function drawRoundedRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

async function renderRankCard(username, avatarUrl, level, xp, nextGrade, nextXp, progress, currentEmoji, nextEmoji) {
    const width = 700;
    const height = 220;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dégradé de fond sombre et moderne
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#111214');
    grad.addColorStop(0.5, '#1e1f22');
    grad.addColorStop(1, '#2b2d31');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Lignes géométriques décoratives (style CODM)
    ctx.strokeStyle = 'rgba(254, 188, 17, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width - 150, 0);
    ctx.lineTo(width, 150);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width - 120, 0);
    ctx.lineTo(width, 120);
    ctx.stroke();

    // 2. Avatar de l'utilisateur en cercle
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(100, height / 2, 70, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 30, height / 2 - 70, 140, 140);
        ctx.restore();

        // Anneau d'avatar doré
        ctx.strokeStyle = '#febc11';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(100, height / 2, 72, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        console.error("Error drawing avatar on canvas:", e);
        ctx.fillStyle = '#febc11';
        ctx.beginPath();
        ctx.arc(100, height / 2, 70, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Textes
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(username, 200, 65);

    // Grade actuel
    ctx.fillStyle = '#febc11';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${currentEmoji} ${level}`, 200, 100);

    // Stats XP
    ctx.fillStyle = '#b5bac1';
    ctx.font = '16px sans-serif';
    const xpText = nextGrade === "Max" 
        ? `${xp.toLocaleString()} XP (Grade Max atteint)` 
        : `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP`;
    ctx.fillText(xpText, 200, 135);

    // Prochain Grade (aligné à droite)
    if (nextGrade !== "Max") {
        ctx.fillStyle = '#949ba4';
        ctx.font = '14px sans-serif';
        const nextText = `Suivant : ${nextEmoji} ${nextGrade}`;
        ctx.fillText(nextText, width - 250, 100);
    }

    // Pourcentage (aligné à droite)
    ctx.fillStyle = '#febc11';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${progress.toFixed(1)}%`, width - 80, 135);

    // 4. Barre de progression
    const barX = 200;
    const barY = 155;
    const barWidth = 450;
    const barHeight = 22;
    const radius = 11;

    // Fond de la barre
    ctx.fillStyle = '#35363c';
    drawRoundedRect(ctx, barX, barY, barWidth, barHeight, radius, true, false);

    // Remplissage de la barre
    if (progress > 0) {
        const fillWidth = (barWidth * Math.min(progress, 100)) / 100;
        const progressGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
        progressGrad.addColorStop(0, '#febc11');
        progressGrad.addColorStop(1, '#f39c12');
        ctx.fillStyle = progressGrad;
        drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, radius, true, false);
    }

    return canvas.toBuffer();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Affiche ton rang et ton XP CODM')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur à vérifier')),
    async execute(interaction) {
        const target = interaction.options.getMember('user') || interaction.member;

        const guildId = interaction.guild.id;
        const userDoc = await db.collection('guilds').doc(guildId).collection('users').doc(target.id).get();

        if (!userDoc.exists) {
            return interaction.reply({ content: 'Cet utilisateur n\'a pas encore d\'XP sur ce serveur.', flags: [64] });
        }

        await interaction.deferReply();

        // Fetch dynamic grades or use defaults with Cache
        let codmGrades = gradesCache.get(guildId);
        if (!codmGrades) {
            const gradesDoc = await db.collection('guilds').doc(guildId).collection('config').doc('grades').get();
            codmGrades = gradesDoc.exists ? gradesDoc.data().paliers : CODM_GRADES;
            gradesCache.set(guildId, codmGrades);
            setTimeout(() => gradesCache.delete(guildId), 5 * 60 * 1000);
        }

        const data = userDoc.data() || {};
        const bufferedXp = getBufferedXP(guildId, target.id);
        const xp = (data.xp || 0) + bufferedXp;

        // Recalculer le niveau en fonction de l'XP réelle (y compris en tampon)
        let level = codmGrades[0].name;
        for (const grade of codmGrades) {
            if (xp >= grade.xp) {
                level = grade.name;
            } else {
                break;
            }
        }

        // Trouver le prochain niveau
        let nextGrade = "Max";
        let nextXp = xp;
        for (let i = 0; i < codmGrades.length; i++) {
            if (codmGrades[i].name === level && i < codmGrades.length - 1) {
                nextGrade = codmGrades[i + 1].name;
                nextXp = codmGrades[i + 1].xp;
                break;
            }
        }

        const currentGradeObj = codmGrades.find(g => g.name === level);
        const currentEmoji = currentGradeObj?.emoji || '🎖️';
        const progress = nextGrade === "Max" ? 100 : (xp / nextXp) * 100;
        const nextGradeObj = nextGrade === "Max" ? null : codmGrades.find(g => g.name === nextGrade);
        const nextEmoji = nextGradeObj?.emoji || '🎖️';

        const avatarUrl = target.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 128 });

        try {
            const buffer = await renderRankCard(
                target.user.username,
                avatarUrl,
                level,
                xp,
                nextGrade,
                nextXp,
                progress,
                currentEmoji,
                nextEmoji
            );

            const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (e) {
            console.error("Error creating rank card image:", e);
            // Fallback text embed if canvas fails
            const rankEmbed = new EmbedBuilder()
                .setColor('#febc11')
                .setTitle(`Profil CODM de ${target.user.username}`)
                .setDescription("La génération graphique a échoué. Voici vos statistiques textuelles :")
                .addFields(
                    { name: 'Grade', value: `${currentEmoji} \`${level}\``, inline: true },
                    { name: 'XP Totale', value: `\`${xp}\` XP`, inline: true },
                    { name: 'Prochain Grade', value: nextGrade === "Max" ? "🚀 `Grade Maximum atteint !`" : `${nextEmoji} \`${nextGrade}\` (\`${nextXp}\` XP)\n➡️ XP Restant : \`${nextGrade === "Max" ? 0 : nextXp - xp}\``, inline: false },
                )
                .setFooter({ text: `Progression: ${progress.toFixed(1)}%` });
            await interaction.editReply({ embeds: [rankEmbed] });
        }
    },
};
