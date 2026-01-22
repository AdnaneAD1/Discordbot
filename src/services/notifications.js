const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('./firebase');
const Parser = require('rss-parser');
const axios = require('axios');
const parser = new Parser();

const checkTwitch = async (client, account) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_ACCESS_TOKEN) {
        return; // Skip if credentials are missing
    }

    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${account.username}`, {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
            }
        });

        const stream = response.data.data[0];
        if (stream && !account.isLive) {
            const channel = client.channels.cache.get(account.channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor('#6441a5')
                    .setTitle(`🟣 LIVE : ${stream.user_name} est en direct !`)
                    .setDescription(`**Titre :** ${stream.title}\n**Jeu :** ${stream.game_name}`)
                    .setURL(`https://twitch.tv/${stream.user_login}`)
                    .setThumbnail(stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'))
                    .setTimestamp();

                channel.send({ content: `@everyone Hey ! **${stream.user_name}** est en live sur Twitch !`, embeds: [embed] });
                await db.collection('socials').doc(account.id).update({ isLive: true });
            }
        } else if (!stream && account.isLive) {
            await db.collection('socials').doc(account.id).update({ isLive: false });
        }
    } catch (error) {
        console.error('Twitch Check Error:', error.message);
    }
};

const checkYouTube = async (client, account) => {
    try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${account.username}`);
        const lastVideo = feed.items[0];

        if (lastVideo && lastVideo.id !== account.lastPostId) {
            const channel = client.channels.cache.get(account.channelId);
            if (channel) {
                channel.send(`🔴 NOUVELLE VIDÉO ! **${lastVideo.title}** est maintenant disponible sur YouTube.\n${lastVideo.link}`);
                await db.collection('socials').doc(account.id).update({ lastPostId: lastVideo.id });
            }
        }
    } catch (error) {
        console.error('YouTube Check Error:', error.message);
    }
};

const checkTikTok = async (client, account) => {
    if (!account.username || !account.channelId) return;

    try {
        const username = account.username.replace('@', '');
        const url = `https://www.tiktok.com/@${username}/live`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000
        });

        const html = response.data;

        // --- DATA EXTRACTION ---
        // Helper to extract JSON data from script tags
        const extractJson = (html, scriptId) => {
            try {
                const regex = new RegExp(`<script id="${scriptId}"[^>]*>([\\s\\S]*?)<\/script>`);
                const match = html.match(regex);
                return match ? JSON.parse(match[1]) : null;
            } catch (e) { return null; }
        };

        const universalData = extractJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
        const sigiState = extractJson(html, 'SIGI_STATE');

        // Fallback RegEx extraction for meta properties
        const getMeta = (prop) => {
            const match = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`));
            return match ? match[1] : null;
        };

        // --- 1. LIVE DETECTION & DATA ---
        let isLive = false;

        // Data sources
        const userInfo = sigiState?.LiveRoom?.liveRoomUserInfo || universalData?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
        const user = userInfo?.user;
        const liveRoom = userInfo?.liveRoom;

        if (user?.status === 2 || html.includes('"status":2')) {
            isLive = true;
        }

        const nickname = user?.nickname || username;
        const liveTitle = liveRoom?.title || getMeta("og:title") || `Live de ${nickname}`;
        // Robust cover search: JSON first, then Meta
        const liveCover = liveRoom?.cover?.url_list?.[0] || getMeta("og:image");
        const userAvatar = user?.avatarLarger || 'https://sf-static.six-group.com/images/tiktok-logo.png';
        const viewerCount = liveRoom?.viewerCount || 0;
        const startTime = liveRoom?.startTime; // Unix timestamp in seconds

        // Calculate Duration
        let durationText = "En direct";
        const now = Date.now();
        if (startTime) {
            const diff = Math.floor(now / 1000) - startTime;
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        // --- LIVE NOTIFICATION LOGIC ---
        const ONE_HOUR = 60 * 60 * 1000;

        // Went LIVE (First announcement)
        if (isLive && !account.isLive) {
            if (account.isLive === undefined) {
                // Initialize for first time without spamming
                await db.collection('socials').doc(account.id).update({ isLive: true, lastLiveMessageTime: now });
            } else {
                const channel = client.channels.cache.get(account.channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0050')
                        .setTitle(`🔴 ${nickname} est en LIVE sur TikTok !`)
                        .setDescription(liveTitle)
                        .setURL(`https://www.tiktok.com/@${username}/live`)
                        .setThumbnail(userAvatar)
                        .setImage(liveCover)
                        .addFields(
                            { name: 'Durée', value: `⏳ \`${durationText}\``, inline: true }
                        )
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('▶️ Regarder le live')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://www.tiktok.com/@${username}/live`)
                    );

                    await channel.send({
                        content: `@everyone 🚨 **ALERTE LIVE** : **${nickname}** lance son stream !`,
                        embeds: [embed],
                        components: [row]
                    });

                    await db.collection('socials').doc(account.id).update({
                        isLive: true,
                        lastLiveMessageTime: now
                    });
                }
            }
        }
        // REMINDER (Still Live)
        else if (isLive && account.isLive) {
            const lastTime = account.lastLiveMessageTime || 0;
            if (now - lastTime > ONE_HOUR) {
                const channel = client.channels.cache.get(account.channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0050')
                        .setTitle(`⏳ Rappel : ${nickname} est toujours en LIVE !`)
                        .setDescription(`Rejoignez le stream si ce n'est pas déjà fait !\n\n**${liveTitle}**`)
                        .setURL(`https://www.tiktok.com/@${username}/live`)
                        .setThumbnail(userAvatar)
                        .setImage(liveCover)
                        .addFields(
                            { name: 'Durée', value: `⏳ \`${durationText}\``, inline: true }
                        )
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('▶️ Rejoindre maintenant')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://www.tiktok.com/@${username}/live`)
                    );

                    await channel.send({
                        content: `📢 **RAPPEL** : @everyone Le live de **${nickname}** est toujours en cours !`,
                        embeds: [embed],
                        components: [row]
                    });

                    await db.collection('socials').doc(account.id).update({
                        lastLiveMessageTime: now
                    });
                }
            }
        }
        // Went OFFLINE
        else if (!isLive && account.isLive) {
            await db.collection('socials').doc(account.id).update({ isLive: false });
        }


        // --- 2. NEW POST DETECTION ---
        let videoId = null;
        let videoDesc = "";
        let videoThumb = "";

        // Extraction via JSON ItemList
        if (sigiState?.ItemList?.['user-post']?.list) {
            const list = sigiState.ItemList['user-post'].list;
            if (list.length > 0) {
                videoId = list[0];
                const item = sigiState.ItemModule?.[videoId];
                if (item) {
                    videoDesc = item.desc;
                    videoThumb = item.video?.cover;
                }
            }
        }

        // Regex fallback for video ID
        if (!videoId) {
            const videoMatch = html.match(/"itemStruct":\{"id":"(\d{19})"/);
            if (videoMatch) videoId = videoMatch[1];
        }

        if (videoId && videoId !== account.lastPostId) {
            if (!account.lastPostId) {
                // Initialize
                await db.collection('socials').doc(account.id).update({ lastPostId: videoId });
            } else {
                const channel = client.channels.cache.get(account.channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0050')
                        .setTitle(`🎬 Va voir ${username}, il a posté une nouvelle vidéo !`)
                        .setDescription(videoDesc || "Nouvelle vidéo disponible sur TikTok !")
                        .setURL(`https://www.tiktok.com/@${username}/video/${videoId}`)
                        .setImage(videoThumb || liveCover)
                        .setFooter({ text: 'TikTok', iconURL: 'https://sf-static.six-group.com/images/tiktok-logo.png' })
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('▶️ Voir la vidéo')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://www.tiktok.com/@${username}/video/${videoId}`)
                    );

                    await channel.send({
                        embeds: [embed],
                        components: [row]
                    });

                    await db.collection('socials').doc(account.id).update({ lastPostId: videoId });
                }
            }
        }

    } catch (error) {
        if (error.response?.status !== 404) {
            console.error(`TikTok Check Error (@${account.username}):`, error.message);
        }
    }
};

const initNotifications = (client) => {
    // Randomize interval between 90s and 180s
    const getInterval = () => Math.floor(Math.random() * (180000 - 90000 + 1) + 90000);

    const runCheck = async () => {
        try {
            const socialsSnapshot = await db.collection('socials').get();
            for (const doc of socialsSnapshot.docs) {
                const account = { id: doc.id, ...doc.data() };
                if (account.platform === 'Twitch') await checkTwitch(client, account);
                else if (account.platform === 'YouTube') await checkYouTube(client, account);
                else if (account.platform === 'TikTok') await checkTikTok(client, account);
            }
        } catch (error) {
            console.error('Notification Service Error:', error.message);
        }

        setTimeout(runCheck, getInterval());
    };

    runCheck();
};

module.exports = { initNotifications };
