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
    // Note: TikTok public scraping is unreliable without official API.
    // This is a placeholder for TikTok logic using a simulated check or a third-party API.
    try {
        // Placeholder check
        // In a real scenario, you'd use a TikTok scraper or an API like RapidAPI.
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
