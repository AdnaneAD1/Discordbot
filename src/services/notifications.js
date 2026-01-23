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

        // Capture & Persist secUid if missing
        if (user?.secUid && account.secUid !== user.secUid) {
            console.log(`[TikTok] SecUid captured for ${username}: ${user.secUid}`);
            await db.collection('socials').doc(account.id).update({ secUid: user.secUid });
            account.secUid = user.secUid; // Update local reference for immediate use
        }

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


        // --- 2. NEW POST DETECTION (API MODE) ---
        // Constraint: Use internal endpoint, do not parse HTML for posts, strict videoId comparison.

        let videoId = null;
        let videoDesc = "";
        let videoThumb = "";
        let finalVideoUrl = "";

        if (account.secUid) {
            try {
                // Fetch list using internal API
                const apiResponse = await axios.get(`https://www.tiktok.com/api/post/item_list/?aid=1988&secUid=${account.secUid}&count=30`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/',
                        'Cookie': 'tt_webid_v2=1234567890;' // Fake generic cookie might help avoiding immediate rejected requests
                    },
                    timeout: 8000
                });

                const itemList = apiResponse.data?.itemList;
                if (itemList && Array.isArray(itemList) && itemList.length > 0) {
                    const latest = itemList[0];
                    videoId = latest.id;
                    videoDesc = latest.desc;
                    videoThumb = latest.video?.cover?.url_list?.[0] || latest.video?.cover;
                    finalVideoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
                    console.log(`[TikTok API] OK for ${username}: ${itemList.length} items found. Latest: ${videoId}`);
                } else {
                    console.log(`[TikTok API] OK for ${username}: 0 items found (or private).`);
                }
            } catch (apiError) {
                console.warn(`[TikTok API] Failed to fetch posts for ${username}: ${apiError.message}`);
                // Do NOT fallback to HTML regex to avoid "Phantom" posts. API is the source of truth.
            }
        } else {
            console.log(`[TikTok API] Skipped for ${username}: No secUid yet.`);
        }

        // --- NOTIFICATION & STORAGE ---
        // Only proceed if we have a valid videoId and it is DIFFERENT from the last one.
        if (videoId && videoId !== account.lastPostId) {
            // First time initialization
            if (!account.lastPostId) {
                await db.collection('socials').doc(account.id).update({ lastPostId: videoId });
            }
            // New Video Detected
            else {
                const channel = client.channels.cache.get(account.channelId);
                if (channel) {
                    // Use extracted nickname or username if nickname unavailable
                    const displayIdentity = nickname || username;

                    const embed = new EmbedBuilder()
                        .setColor('#ff0050')
                        .setTitle(`🎬 Va voir ${displayIdentity}, il a posté une nouvelle vidéo !`)
                        .setDescription(videoDesc.length > 100 ? videoDesc.substring(0, 97) + '...' : (videoDesc || "Nouvelle vidéo disponible sur TikTok !"))
                        .setURL(finalVideoUrl)
                        .setImage(videoThumb || liveCover) // Fallback to profile/live cover if thumb missing
                        .setFooter({ text: 'TikTok', iconURL: 'https://sf-static.six-group.com/images/tiktok-logo.png' })
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('▶️ Voir la vidéo')
                            .setStyle(ButtonStyle.Link)
                            .setURL(finalVideoUrl)
                    );

                    await channel.send({
                        embeds: [embed],
                        components: [row]
                    });

                    // Update State Immediately
                    await db.collection('socials').doc(account.id).update({ lastPostId: videoId });
                    console.log(`[TikTok] Notification sent for ${displayIdentity} - Video: ${videoId}`);
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
