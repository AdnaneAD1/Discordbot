const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../services/firebase');

const HUGGING_FACE_API = 'https://router.huggingface.co/hf-inference/models/unitary/toxic-bert';

const { isGuildPremium } = require('../services/subscriptions');

async function checkToxicity(message) {
    if (message.author.bot || !message.guild || !message.content || message.content.length < 5) return;

    // Vérifier si le serveur est Premium (Titan Server)
    const guildPrem = await isGuildPremium(message.guild.id);
    if (!guildPrem.isPremium) return;

    try {
        const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
        const response = await axios.post(
            HUGGING_FACE_API,
            { inputs: message.content },
            { headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" } }
        );

        const results = response.data[0];
        // Toxic-BERT renvoie des scores pour 'toxic', 'severe_toxic', 'obscene', 'threat', 'insult', 'identity_hate'
        const toxicScore = results.find(r => r.label === 'toxic')?.score || 0;

        if (toxicScore > 0.70) {
            await alertAdmins(message, toxicScore, results);
        }
    } catch (error) {
        if (error.response?.status === 503) {
            console.log('[Sentinel] Le modèle IA est en cours de chargement...');
        } else {
            console.error('[Sentinel] Erreur analyse toxicité:', error);
        }
    }
}

async function alertAdmins(message, mainScore, allScores) {
    const guildId = message.guild.id;
    const configDoc = await db.collection('guilds').doc(guildId).collection('config').doc('moderation').get();
    const alertChannelId = configDoc.exists ? configDoc.data().alertChannelId : null;

    if (!alertChannelId) return;

    const channel = message.guild.channels.cache.get(alertChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Sentinel : Alerte Toxicité')
        .setColor('#e74c3c')
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
            { name: 'Utilisateur', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Score de Toxicité', value: `\`${(mainScore * 100).toFixed(1)}%\``, inline: true },
            { name: 'Contenu Suspect', value: `"${message.content.substring(0, 500)}${message.content.length > 500 ? '...' : ''}"` }
        )
        .setTimestamp();

    // Ajouter détail des autres labels si élevés
    const details = allScores
        .filter(s => s.score > 0.5 && s.label !== 'toxic')
        .map(s => `• **${s.label}**: ${(s.score * 100).toFixed(0)}%`)
        .join('\n');

    if (details) embed.addFields({ name: 'Détails IA', value: details });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Voir le message')
            .setURL(message.url)
            .setStyle(ButtonStyle.Link)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

module.exports = { checkToxicity };
