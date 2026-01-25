const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const { initMusic } = require('./services/music');
const { initNotifications } = require('./services/notifications');
const WerewolfManager = require('./systems/werewolf/index');

client.commands = new Collection();
client.kazagumo = initMusic(client);
client.werewolf = new WerewolfManager(client);
initNotifications(client);

// Load Commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

const { cleanupExpiredChallenges } = require('./systems/challenges');

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Nettoyage initial au démarrage
    cleanupExpiredChallenges(client);

    // Nettoyage toutes les 15 minutes
    setInterval(() => {
        cleanupExpiredChallenges(client);
    }, 15 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
