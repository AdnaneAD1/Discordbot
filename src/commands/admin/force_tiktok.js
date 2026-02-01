const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db } = require('../../services/firebase');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('force_tiktok')
        .setDescription('Force l\'envoi d\'une notification TikTok pour une vidéo spécifique (bypass cache)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Le lien de la vidéo TikTok (ex: https://www.tiktok.com/@user/video/...)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const url = interaction.options.getString('url');

        // 1. Extraire l'ID vidéo et le username de l'URL
        // Formats possibles: 
        // https://www.tiktok.com/@username/video/7601729818664668438
        // https://vm.tiktok.com/ZM... (shortlinks - on ne gère pas nativement sans redirect, on demande le lien long)

        const regex = /@([\w\.]+)\/video\/(\d+)/;
        const match = url.match(regex);

        if (!match) {
            return interaction.editReply('❌ Lien invalide. Utilisez le format complet : `https://www.tiktok.com/@username/video/ID`');
        }

        const username = match[1];
        const videoId = match[2];

        try {
            // 2. Trouver la config sociale pour ce username en base
            // Le username en base peut avoir @ ou pas
            const socialsRef = db.collection('socials');
            const q1 = await socialsRef.where('username', '==', `@${username}`).get();
            const q2 = await socialsRef.where('username', '==', username).get();

            let accountDoc = null;
            if (!q1.empty) accountDoc = q1.docs[0];
            else if (!q2.empty) accountDoc = q2.docs[0];

            if (!accountDoc) {
                return interaction.editReply(`❌ Aucun compte configuré pour le pseudo **${username}** dans le bot.`);
            }

            const account = accountDoc.data();
            const accountId = accountDoc.id;

            // 3. Récupérer les infos via oEmbed (La source fiable)
            const oembedUrl = `https://www.tiktok.com/oembed?url=${url}`;
            const oembedRes = await axios.get(oembedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1' }
            });

            const data = oembedRes.data;
            const videoTitle = data.title || "Nouvelle vidéo disponible !";
            const videoCover = data.thumbnail_url;
            const authorName = data.author_name;

            // 4. Envoyer la notification sur Discord
            const channel = interaction.client.channels.cache.get(account.channelId);
            if (!channel) {
                return interaction.editReply(`❌ Le salon de notification configuré (${account.channelId}) est introuvable.`);
            }

            // Récupérer avatar user si possible (depuis les data du bot ou une image par défaut)
            // On ne peut pas facilement avoir l'avatar via oEmbed, on utilise le logo TikTok ou une image générique
            const userAvatar = 'https://sf-static.six-group.com/images/tiktok-logo.png';

            const embed = new EmbedBuilder()
                .setColor('#ff0050')
                .setTitle(`🎬 ${authorName} a posté une nouvelle vidéo sur TikTok !`)
                .setDescription(videoTitle)
                .setURL(url)
                .setThumbnail(userAvatar)
                .setFooter({ text: 'TikTok • Notification Forcée', iconURL: 'https://sf-static.six-group.com/images/tiktok-logo.png' })
                .setTimestamp();

            if (videoCover) embed.setImage(videoCover);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('▶️ Voir la vidéo')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            );

            await channel.send({
                content: `📢 **NOUVELLE VIDÉO** : @everyone **${authorName}** vient de poster !`,
                embeds: [embed],
                components: [row]
            });

            // 5. Mettre à jour la DB pour éviter un doublon futur
            // On met à jour lastPostId avec cet ID
            await db.collection('socials').doc(accountId).update({ lastPostId: videoId });

            await interaction.editReply(`✅ **Notification envoyée avec succès !**\nID Vidéo: \`${videoId}\`\nBase de données mise à jour.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Erreur technique : ${error.message}`);
        }
    },
};
