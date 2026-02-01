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

            // 3. Récupérer les infos via oEmbed (La source fiable, mais avec fallback)
            const randomUserAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ];

            let videoTitle = "Nouvelle vidéo disponible !";
            let videoCover = null;
            let authorName = account.nickname || username;
            let userAvatar = account.userAvatar || 'https://sf-static.six-group.com/images/tiktok-logo.png';

            try {
                // Tentaiva 1: oEmbed (Rapide et propre)
                const oembedUrl = `https://www.tiktok.com/oembed?url=${url}&v=${Date.now()}`;
                const oembedRes = await axios.get(oembedUrl, {
                    headers: {
                        'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 4000
                });

                if (oembedRes.data) {
                    const data = oembedRes.data;
                    videoTitle = data.title || videoTitle;
                    videoCover = data.thumbnail_url;
                    authorName = data.author_name || authorName;
                }
            } catch (e) {
                console.warn(`[ForceTikTok] oEmbed failed for ${url}, trying HTML scrap fallback...`);

                // Tentative 2: Scraping HTML (Fallback "Sigma")
                try {
                    const htmlRes = await axios.get(url, {
                        headers: {
                            'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                            'Cache-Control': 'no-cache'
                        },
                        timeout: 5000
                    });
                    const html = htmlRes.data;

                    // Extract OG Image (Cover)
                    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
                    if (ogImage) videoCover = ogImage;

                    // Extract Title
                    const ogTitle = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ||
                        html.match(/<title>([^<]+)<\/title>/)?.[1];
                    if (ogTitle) videoTitle = ogTitle.replace(/ \| TikTok$/, "");

                } catch (htmlError) {
                    console.error(`[ForceTikTok] HTML fallback failed too: ${htmlError.message}`);
                }
            }

            // 4. Envoyer la notification sur Discord
            const channel = interaction.client.channels.cache.get(account.channelId);
            if (!channel) {
                return interaction.editReply(`❌ Le salon de notification configuré (${account.channelId}) est introuvable.`);
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0050')
                .setTitle(`🎬 ${authorName} a posté une nouvelle vidéo sur TikTok !`)
                .setDescription(videoTitle)
                .setURL(url)
                .setThumbnail(userAvatar)
                .setFooter({ text: 'TikTok', iconURL: 'https://sf-static.six-group.com/images/tiktok-logo.png' })
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
            await db.collection('socials').doc(accountId).update({ lastPostId: videoId });

            await interaction.editReply(`✅ **Notification envoyée avec succès !**\nAuteur: **${authorName}**\nID Vidéo: \`${videoId}\`\nBase de données mise à jour.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Erreur technique : ${error.message}`);
        }
    },
};
