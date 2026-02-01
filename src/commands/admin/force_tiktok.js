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

            // On s'assure que authorName ne soit JAMAIS juste "@"
            let authorName = (account.nickname && account.nickname !== '@') ? account.nickname : username.replace('@', '');
            let userAvatar = account.userAvatar || 'https://cdn.pixabay.com/photo/2021/01/30/06/42/tiktok-5962992_1280.png';
            const defaultLogo = 'https://cdn.pixabay.com/photo/2021/01/30/06/42/tiktok-5962992_1280.png';

            try {
                // Tentative 1: oEmbed (Rapide et propre)
                const oembedUrl = `https://www.tiktok.com/oembed?url=${url}&v=${Date.now()}`;
                const oembedRes = await axios.get(oembedUrl, {
                    headers: {
                        'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 4000
                });

                if (oembedRes.data && oembedRes.data.author_name) {
                    authorName = oembedRes.data.author_name;
                    videoTitle = oembedRes.data.title || videoTitle;
                    videoCover = oembedRes.data.thumbnail_url;
                }
            } catch (e) {
                console.warn(`[ForceTikTok] oEmbed failed for ${url}, trying HTML scrap fallback...`);

                // Tentative 2: Scraping HTML (Deep fallback)
                // On essaie deux URLs différentes pour maximiser les chances
                const trialUrls = [
                    `https://www.tiktok.com/embed/v2/${videoId}`,
                    url
                ];

                for (const trialUrl of trialUrls) {
                    if (videoCover) break;
                    try {
                        const htmlRes = await axios.get(trialUrl, {
                            headers: {
                                'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                                'Cache-Control': 'no-cache'
                            },
                            timeout: 5000
                        });
                        const html = htmlRes.data;

                        // Plusieurs patterns pour la couverture
                        const coverMatch =
                            html.match(/"poster":"([^"]+)"/) ||
                            html.match(/<meta property="og:image" content="([^"]+)"/) ||
                            html.match(/"cover":"([^"]+)"/);

                        if (coverMatch) {
                            videoCover = coverMatch[1].replace(/\\u002f/g, '/').replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
                        }

                        if (videoTitle === "Nouvelle vidéo disponible !") {
                            const titleMatch = html.match(/<title>([^<]+)<\/title>/) || html.match(/"title":"([^"]+)"/);
                            if (titleMatch) videoTitle = titleMatch[1].split(' | TikTok')[0].replace(/\\u0020/g, ' ');
                        }
                    } catch (err) { continue; }
                }
            }

            // Nettoyage final
            authorName = authorName.replace(/^@/, '').trim();
            if (!authorName) authorName = username.replace('@', '');

            // Fallback ULTIME pour l'image ( Point n°2 )
            // Si aucune miniature n'a été trouvée, on utilise la photo de profil comme grande image
            if (!videoCover) videoCover = userAvatar;

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
                .setThumbnail(userAvatar || defaultLogo)
                .setFooter({ text: 'TikTok', iconURL: defaultLogo })
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
