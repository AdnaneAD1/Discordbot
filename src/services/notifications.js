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
            console.log(`[TikTok-Post] Checking posts (Embed Method) for ${username}...`);

            // Fetch Embed Page (Lighter, more stable, often less blocked)
            const embedUrl = `https://www.tiktok.com/embed/@${username}`;
            const embedResponse = await axios.get(embedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fr-FR',
                },
                timeout: 5000
            });
            const embedHtml = embedResponse.data;

            // Extract all Video IDs (Regex is robust here as structure is simple)
            // Pattern: /video/7547573750439349526
            const videoIdMatches = [...embedHtml.matchAll(/\/video\/(\d{19})/g)];
            const foundIds = videoIdMatches.map(match => match[1]);

            let latestVideoId = null;

            if (foundIds.length > 0) {
                // Deduplicate
                const uniqueIds = [...new Set(foundIds)];

                // Sort Descending (Newest ID = Highest Number)
                // We use BigInt for accurate comparison of 19-digit numbers
                uniqueIds.sort((a, b) => {
                    if (BigInt(a) < BigInt(b)) return 1;
                    if (BigInt(a) > BigInt(b)) return -1;
                    return 0;
                });

                latestVideoId = uniqueIds[0];
                console.log(`[TikTok-Post] Latest ID found via Embed: ${latestVideoId}`);
            }

            if (!latestVideoId) {
                console.log(`[TikTok-Post] No video IDs found in Embed for ${username}`);
            } else {
                if (latestVideoId !== account.lastPostId) {
                    if (!account.lastPostId) {
                        console.log(`[TikTok-Post] Initializing lastPostId for ${username}: ${latestVideoId}`);
                        await db.collection('socials').doc(account.id).update({ lastPostId: latestVideoId });
                    } else {
                        // Double check: Is the new ID actually bigger than the old one?
                        // This prevents notifying for an old pinned video if the DB had a newer one
                        if (BigInt(latestVideoId) > BigInt(account.lastPostId)) {
                            console.log(`[TikTok-Post] NEW REAL POST DETECTED for ${username}: ${latestVideoId}`);

                            const channel = client.channels.cache.get(account.channelId);
                            if (channel) {
                                const embed = new EmbedBuilder()
                                    .setColor('#ff0050')
                                    .setTitle(`🎬 Va voir ${nickname}, il a posté une nouvelle vidéo !`)
                                    .setDescription("Nouvelle vidéo disponible sur TikTok !")
                                    .setURL(`https://www.tiktok.com/@${username}/video/${latestVideoId}`)
                                    .setFooter({ text: 'TikTok', iconURL: 'https://sf-static.six-group.com/images/tiktok-logo.png' })
                                    .setTimestamp();

                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setLabel('▶️ Voir la vidéo')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(`https://www.tiktok.com/@${username}/video/${latestVideoId}`)
                                );

                                await channel.send({
                                    embeds: [embed],
                                    components: [row]
                                });

                                await db.collection('socials').doc(account.id).update({ lastPostId: latestVideoId });
                                console.log(`[TikTok-Post] Notification sent and DB updated for ${username}`);
                            }
                        } else {
                            console.log(`[TikTok-Post] Detected ID ${latestVideoId} is not newer than stored ${account.lastPostId}. Ignoring.`);
                        }
                    }
                } else {
                    console.log(`[TikTok-Post] No new post for ${username} (still ${latestVideoId})`);
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
