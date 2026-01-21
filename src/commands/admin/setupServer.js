const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupserver')
        .setDescription('Initialise automatiquement les salons et rôles standards du serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        try {
            // 1. Create Category
            let category = guild.channels.cache.find(c => c.name === '🤖 BOT CODM' && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({ name: '🤖 BOT CODM', type: ChannelType.GuildCategory });
            }

            // 2. Create Channels
            const channelsToCreate = [
                { name: '👋┃bienvenue', topic: 'Arrivées des nouveaux membres' },
                { name: '📋┃règlement', topic: 'Règles du serveur' },
                { name: '📢┃annonces-sociales', topic: 'Notifications Twitch/YT/TikTok' },
                { name: '👮┃mod-logs', topic: 'Logs de modération' }
            ];

            const createdChannels = {};
            for (const ch of channelsToCreate) {
                let channel = guild.channels.cache.find(c => c.name === ch.name);
                if (!channel) {
                    channel = await guild.channels.create({
                        name: ch.name,
                        topic: ch.topic,
                        parent: category.id,
                        type: ChannelType.GuildText
                    });
                }
                createdChannels[ch.name] = channel.id;
            }

            // 3. Update Firebase Config (Guild Specific)
            await db.collection('guilds').doc(guild.id).collection('config').doc('channels').set({
                welcomeChannelId: createdChannels['👋┃bienvenue'],
                rulesChannelId: createdChannels['📋┃règlement'],
                socialChannelId: createdChannels['📢┃annonces-sociales'],
                modLogChannelId: createdChannels['👮┃mod-logs']
            }, { merge: true });

            await interaction.editReply({ content: '✅ Le serveur a été initialisé avec succès ! Salons créés et configurés dans la base de données.' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'initialisation.' });
        }
    },
};
