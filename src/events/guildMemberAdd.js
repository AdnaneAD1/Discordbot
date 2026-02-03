const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // S'assurer que le membre est complet (gestion des Partials)
        if (member.partial) {
            try {
                member = await member.fetch();
            } catch (error) {
                console.error('Erreur lors du fetch du membre:', error);
            }
        }

        console.log(`New member joined: ${member.user.tag}`);

        // Fetch config via cache
        const guildId = member.guild.id;
        const configCache = require('../services/configCache');

        // Récupérer les configs via le cache
        const [config, roles, general] = await Promise.all([
            configCache.getConfig(guildId, 'channels'),
            configCache.getConfig(guildId, 'roles'),
            configCache.getConfig(guildId, 'general')
        ]);

        const embedColor = general?.embedColor || '#0099ff';
        const serverName = general?.serverName || 'Mister A';

        // Assign "Novice" role if exists
        if (roles && roles.defaultRoleId) {
            await member.roles.add(roles.defaultRoleId).catch(console.error);
        }

        // Welcome message
        if (config && config.welcomeChannelId) {
            const channel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (channel) {
                // Find rules channel (either by ID from config or by name)
                let rulesChannel = member.guild.channels.cache.get(config.rulesChannelId);
                if (!rulesChannel) {
                    rulesChannel = member.guild.channels.cache.find(c => c.name.includes('règlement') || c.name.includes('rules'));
                }

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setDescription(`Bienvenue sur le serveur de **${serverName}**, **${member.user.displayName}** !\n\nN'oublie pas de lire le ${rulesChannel ? `<#${rulesChannel.id}>` : '#📋┃règlement'} pour bien commencer l'aventure.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setTimestamp();

                // Petite attente pour laisser au client Discord le temps de résoudre la mention
                setTimeout(() => {
                    channel.send({ content: `${member}`, embeds: [welcomeEmbed] }).catch(console.error);
                }, 1500);
            }
        }
    },
};
