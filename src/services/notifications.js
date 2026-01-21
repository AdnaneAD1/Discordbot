const { EmbedBuilder } = require('discord.js');
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
    try {
        const username = account.username.replace('@', '');
        const url = `https://www.tiktok.com/@${username}/live`;

        // 1. Check Live Status (Scraping markers)
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const isLive = response.data.includes('"liveRoom"') && !response.data.includes('"liveRoom":null');

        if (isLive && !account.isLive) {
            const channel = client.channels.cache.get(account.channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor('#010101')
                    .setTitle(`⚫ TIKTOK LIVE : @${username} est en direct !`)
                    .setURL(`https://www.tiktok.com/@${username}/live`)
                    .setDescription(`Rejoins le live maintenant !`)
                    .setThumbnail('https://sf-static.six-group.com/images/tiktok-logo.png')
                    .setTimestamp();

                channel.send({ content: `@everyone Hey ! **@${username}** est en live sur TikTok !`, embeds: [embed] });
                await db.collection('socials').doc(account.id).update({ isLive: true });
            }
        } else if (!isLive && account.isLive) {
            await db.collection('socials').doc(account.id).update({ isLive: false });
        }

        // 2. Check for latest video (Simple ID extraction)
        const videoMatch = response.data.match(/"id":"(\d{18,20})"/);
        const lastVideoId = videoMatch ? videoMatch[1] : null;

        if (lastVideoId && lastVideoId !== account.lastPostId) {
            const channel = client.channels.cache.get(account.channelId);
            if (channel) {
                channel.send(`⚫ NOUVEAU TIKTOK ! **@${username}** a posté une nouvelle vidéo.\nhttps://www.tiktok.com/@${username}/video/${lastVideoId}`);
                await db.collection('socials').doc(account.id).update({ lastPostId: lastVideoId });
            }
        }
    } catch (error) {
        console.error('TikTok Check Error:', error.message);
    }
};

const initNotifications = (client) => {
    setInterval(async () => {
        const socialsSnapshot = await db.collection('socials').get();
        socialsSnapshot.forEach(doc => {
            const account = { id: doc.id, ...doc.data() };
            if (account.platform === 'Twitch') checkTwitch(client, account);
            else if (account.platform === 'YouTube') checkYouTube(client, account);
            else if (account.platform === 'TikTok') checkTikTok(client, account);
        });
    }, 5 * 60 * 1000); // Every 5 minutes
};

module.exports = { initNotifications };
