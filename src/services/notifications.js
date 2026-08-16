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

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('▶️ Regarder le live')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://twitch.tv/${stream.user_login}`)
                );

                await channel.send({
                    content: `@everyone 🚨 **ALERTE LIVE** : **${stream.user_name}** est en live sur Twitch !`,
                    embeds: [embed],
                    components: [row]
                });
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
                const videoId = lastVideo.id.replace('yt:video:', '');
                const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(`🔴 NOUVELLE VIDÉO : ${lastVideo.author || 'YouTube'}`)
                    .setDescription(lastVideo.title)
                    .setURL(lastVideo.link)
                    .setImage(thumbnailUrl)
                    .setTimestamp(new Date(lastVideo.isoDate || Date.now()));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('▶️ Regarder la vidéo')
                        .setStyle(ButtonStyle.Link)
                        .setURL(lastVideo.link)
                );

                await channel.send({
                    content: `📢 **NOUVELLE VIDÉO** : @everyone **${lastVideo.author || 'YouTube'}** vient de publier une vidéo !`,
                    embeds: [embed],
                    components: [row]
                });
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
        const liveDetail = universalData?.__DEFAULT_SCOPE__?.["webapp.live-detail"];
        const user = userInfo?.user || liveDetail?.userInfo?.user;
        const liveRoom = userInfo?.liveRoom || liveDetail?.liveRoom;

        if (user?.status === 2 || html.includes('"status":2') || liveRoom?.status === 2) {
            isLive = true;
        }

        const nickname = user?.nickname || username;
        // Search for title in multiple places
        const liveTitle = liveRoom?.title ||
            getMeta("og:title")?.replace(/ \| TikTok$/, "") ||
            sigiState?.SEO?.metaData?.title ||
            `Live de ${nickname}`;

        // Search for cover in multiple places
        const liveCover = liveRoom?.cover?.url_list?.[0] ||
            liveRoom?.owner?.avatarLarger ||
            getMeta("og:image") ||
            user?.avatarLarger;
        const userAvatar = user?.avatarLarger || 'https://cdn.pixabay.com/photo/2021/01/30/06/42/tiktok-5962992_1280.png';
        const viewerCount = liveRoom?.viewerCount || 0;
        const startTime = liveRoom?.startTime; // Unix timestamp in seconds

        // SAUVEGARDE SYSTÉMATIQUE DE L'AVATAR (pour les commandes manuelles)
        if (userAvatar && userAvatar !== 'https://cdn.pixabay.com/photo/2021/01/30/06/42/tiktok-5962992_1280.png') {
            await db.collection('socials').doc(account.id).update({ userAvatar }).catch(() => null);
        }

        // --- LIVE NOTIFICATION LOGIC ---
        let durationText = "En direct";
        const now = Date.now();
        if (startTime) {
            const diff = Math.floor(now / 1000) - startTime;
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        // --- LIVE NOTIFICATION LOGIC ---
        try {
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
        } catch (error) {
            console.error(`Error in TikTok Live logic for ${username}:`, error);
        }


        // --- 2. NEW POST DETECTION (Embed Method) ---
        try {
            // --- DETECTION LOGIC ---
            const randomUserAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ];

            const embedUrl = `https://www.tiktok.com/embed/@${username}?t=${Date.now()}`;
            const embedResponse = await axios.get(embedUrl, {
                headers: {
                    'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fr-FR',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                timeout: 7000
            });

            const embedHtml = embedResponse.data;

            // Health check: If HTML is too short, we might be blocked or getting an empty state
            if (embedHtml.length < 5000) {
                console.warn(`[TikTok-Open] Warning: Low HTML length (${embedHtml.length}) for ${username}. Possible block.`);
            }

            let potentialIds = [];

            // 1. Advanced JSON Extraction (The Graal)
            const findIdsInJson = (obj) => {
                let ids = [];
                const search = (current) => {
                    if (!current || typeof current !== 'object') return;

                    // Specific known paths
                    if (current.itemModule) {
                        ids = [...ids, ...Object.keys(current.itemModule)];
                    }
                    if (Array.isArray(current.itemList)) {
                        ids = [...ids, ...current.itemList.map(i => i.id).filter(id => id)];
                    }
                    if (Array.isArray(current.items)) {
                        ids = [...ids, ...current.items.map(i => i.id).filter(id => id)];
                    }

                    // Recursion for deep structures
                    for (const key in current) {
                        if (key !== 'parent' && typeof current[key] === 'object') {
                            search(current[key]);
                        }
                    }
                };
                search(obj);
                return [...new Set(ids)];
            };

            const sigiData = extractJson(embedHtml, 'SIGI_STATE');
            const universalData = extractJson(embedHtml, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
            const frontendData = extractJson(embedHtml, '__FRONTEND_WEB_CONTEXT_ID__');

            if (sigiData) potentialIds = [...potentialIds, ...findIdsInJson(sigiData)];
            if (universalData) potentialIds = [...potentialIds, ...findIdsInJson(universalData)];
            if (frontendData) potentialIds = [...potentialIds, ...findIdsInJson(frontendData)];

            // 2. Regex Fallback (Still useful for simple HTML structures)
            const videoIdMatches = [...embedHtml.matchAll(/\/video\/(\d{19,})/g)];
            const regexIds = videoIdMatches.map(match => match[1]);
            potentialIds = [...new Set([...potentialIds, ...regexIds])];

            console.log(`[TikTok-Open] Found ${potentialIds.length} candidate IDs for ${username}`);

            // 3. Deduplicate and Sort Descending (Newest first)
            const uniqueIds = potentialIds.sort((a, b) => {
                try {
                    return BigInt(b) > BigInt(a) ? 1 : -1;
                } catch { return 0; }
            });

            let latestVideoId = null;

            // Iterate through IDs
            for (const candidateId of uniqueIds) {
                if (latestVideoId) break;

                // Optimization: Skip known videos
                if (account.lastPostId && BigInt(candidateId) <= BigInt(account.lastPostId)) {
                    continue;
                }

                // Check ownership via oEmbed (Strict + Extreme Cache Busting)
                try {
                    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}/video/${candidateId}&v=${Date.now()}`;
                    const oembedRes = await axios.get(oembedUrl, {
                        headers: {
                            'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        },
                        timeout: 5000
                    });

                    if (oembedRes.data) {
                        const authorId = oembedRes.data.author_unique_id; // e.g. "tiboinshape"
                        const targetId = username.replace('@', ''); // e.g. "tiboinshape"

                        if (authorId && authorId.toLowerCase() === targetId.toLowerCase()) {
                            latestVideoId = candidateId;
                        } else {
                            console.log(`[TikTok-Post] Ignored ID ${candidateId}: belongs to ${authorId}, not ${targetId}`);
                        }
                    }
                } catch (e) {
                    // Critical Logic Change:
                    // If we found a NEW ID (candidate > lastPostId) but oEmbed verified failed (404/Unknown),
                    // it might be TOO NEW. 
                    // Do NOT skip to the next ID (which might be an old "suggestion"). 
                    // Instead, we 'give up' for this cycle to avoid false positives on old videos.

                    // Only "wait" if it's the very first candidate (the newest).
                    if (candidateId === uniqueIds[0]) {
                        console.log(`[TikTok-Post] Newest ID ${candidateId} failed verification (Wait for propagation). Error: ${e.message}`);
                        break; // Abort search, try again next cycle
                    } else {
                        console.error(`[TikTok-Post] Verification failed for ${candidateId}: ${e.message}`);
                    }
                }
            }


            if (!latestVideoId) {
                console.log(`[TikTok-Post] No new valid video IDs found for ${username}`);
            } else {
                if (!account.lastPostId) {
                    console.log(`[TikTok-Post] Initializing lastPostId for ${username}: ${latestVideoId}`);
                    await db.collection('socials').doc(account.id).update({ lastPostId: latestVideoId });
                } else {
                    console.log(`[TikTok-Post] NEW REAL POST DETECTED for ${username}: ${latestVideoId}`);

                    // Fetch metadata (we know it works and is valid now)
                    let videoCover = null;
                    let videoTitle = "Nouvelle vidéo disponible !";

                    try {
                        const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}/video/${latestVideoId}&v=${Date.now()}`;
                        const oembedRes = await axios.get(oembedUrl, {
                            headers: {
                                'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
                                'Cache-Control': 'no-cache'
                            },
                            timeout: 5000
                        });
                        if (oembedRes.data) {
                            videoCover = oembedRes.data.thumbnail_url;
                            videoTitle = oembedRes.data.title || videoTitle;
                        }
                    } catch (e) {
                        // Fallback provided below
                    }

                    // Fallback for cover
                    if (!videoCover) {
                        const coverMatch = embedHtml.match(new RegExp(`/video/${latestVideoId}[^>]*>.*?<img[^>]*src="([^"]+)"`));
                        if (coverMatch && !coverMatch[1].includes('playButton') && !coverMatch[1].includes('tiktok_web_login_static')) {
                            videoCover = coverMatch[1];
                        }
                    }

                    // Fallback ULTIME : Utiliser l'avatar si pas de couverture
                    if (!videoCover) videoCover = userAvatar;

                    const channel = client.channels.cache.get(account.channelId);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0050')
                            .setTitle(`🎬 ${nickname} a posté une nouvelle vidéo sur TikTok !`)
                            .setDescription(videoTitle)
                            .setURL(`https://www.tiktok.com/@${username}/video/${latestVideoId}`)
                            .setThumbnail(userAvatar)
                            .setFooter({ text: 'TikTok', iconURL: 'https://cdn.pixabay.com/photo/2021/01/30/06/42/tiktok-5962992_1280.png' })
                            .setTimestamp();

                        if (videoCover) embed.setImage(videoCover);

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('▶️ Voir la vidéo')
                                .setStyle(ButtonStyle.Link)
                                .setURL(`https://www.tiktok.com/@${username}/video/${latestVideoId}`)
                        );

                        await channel.send({
                            content: `📢 **NOUVELLE VIDÉO** : @everyone **${nickname}** vient de poster !`,
                            embeds: [embed],
                            components: [row]
                        });

                        await db.collection('socials').doc(account.id).update({
                            lastPostId: latestVideoId,
                            userAvatar: userAvatar // Keep avatar fresh
                        });
                        console.log(`[TikTok-Post] Notification sent and DB updated for ${username}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error in TikTok Post logic (Embed) for ${username}:`, error.message);
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
