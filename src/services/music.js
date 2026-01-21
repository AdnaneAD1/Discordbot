const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const Spotify = require('kazagumo-spotify');

const nodes = [{
    name: 'MainNode',
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE === 'true'
}];

let kazagumo;

const initMusic = (client) => {
    const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: false,
        resume: false,
        reconnectTries: 3,
        restTimeout: 15000
    });

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
    }, shoukaku);

    shoukaku.on('ready', (name) => console.log(`🎵 Lavalink Node "${name}" is connected.`));
    shoukaku.on('error', (name, error) => console.error(`❌ Lavalink Node "${name}" Error:`, error));

    kazagumo.on('playerStart', (player, track) => {
        player.data.get('message')?.channel.send(`🎶 En train de jouer : **${track.title}**`);
    });

    kazagumo.on('playerEmpty', (player) => {
        player.data.get('message')?.channel.send(`📂 La file d'attente est vide.`);
        player.destroy();
    });

    return kazagumo;
};

const getKazagumo = () => kazagumo;

module.exports = { initMusic, getKazagumo };
