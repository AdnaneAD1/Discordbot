const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Spotify = require('kazagumo-spotify');

const nodes = [{
    name: 'MainNode',
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE === 'true'
}];

let kazagumo;

const initMusic = (client) => {
    kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube',
        plugins: [
            new Spotify({
                clientId: process.env.SPOTIFY_CLIENT_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            })
        ],
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        }
    }, new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: true,
        resume: true,
        resumeTimeout: 60,
        reconnectTries: 10,
        restTimeout: 15000,
    });

    kazagumo.shoukaku.on('ready', (name) => console.log(`🎵 Lavalink Node "${name}" is connected.`));
    kazagumo.shoukaku.on('error', (name, error) => console.error(`❌ Lavalink Node "${name}" Error:`, error));

    kazagumo.on('playerStart', (player, track) => {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('music_back').setLabel('Back').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_loop').setLabel('Loop').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_pause').setLabel('Resume & Pause').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Primary),
            );

        player.data.get('message')?.channel.send({
            content: `🎵 **Started playing ${track.title} in General** 🎧`,
            components: [row]
        });
    });

    kazagumo.on('playerEmpty', (player) => {
        player.data.get('message')?.channel.send(`📂 La file d'attente est vide.`);
        player.destroy();
    });

    return kazagumo;
};

const getKazagumo = () => kazagumo;

module.exports = { initMusic, getKazagumo };
