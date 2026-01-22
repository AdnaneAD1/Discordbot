const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Spotify = require('kazagumo-spotify');

const nodes = [{
    name: 'MainNode',
    url: `ws://${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD,
    secure: false
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
                new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('music_back').setEmoji('⏮️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Secondary)
            );

        player.data.get('message')?.channel.send({
            content: `🎵 **En train de jouer : ${track.title}** 🎧`,
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
