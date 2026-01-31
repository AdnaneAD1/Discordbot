const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fixwelcome')
        .setDescription('Corrige les mentions brutes dans les anciens messages de bienvenue')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Nombre de messages à vérifier (max 100)')
                .setMinValue(1)
                .setMaxValue(100)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const limit = interaction.options.getInteger('limit') || 50;

        // 1. Récupérer le salon de bienvenue dans la config
        const guildConfigRef = db.collection('guilds').doc(guildId).collection('config');
        const configDoc = await guildConfigRef.doc('channels').get();
        const welcomeChannelId = configDoc.data()?.welcomeChannelId;

        if (!welcomeChannelId) {
            return interaction.editReply('❌ Aucun salon de bienvenue n\'est configuré.');
        }

        const channel = interaction.guild.channels.cache.get(welcomeChannelId);
        if (!channel) {
            return interaction.editReply('❌ Le salon de bienvenue est introuvable.');
        }

        // 2. Chercher les messages du bot
        const messages = await channel.messages.fetch({ limit });
        let fixedCount = 0;

        for (const message of messages.values()) {
            if (message.author.id !== interaction.client.user.id || message.embeds.length === 0) continue;

            const embed = message.embeds[0];
            const description = embed.description || '';

            // Regex pour détecter les mentions brutes qui n'ont pas été résolues (souvent <@ID> dans une string d'embed)
            // On cherche le motif Bienvenue suivi de <@...
            const match = description.match(/<@!?(\d+)>/);
            if (description.includes('Bienvenue') && match) {
                try {
                    const userId = match[1];
                    await interaction.client.users.fetch(userId).catch(() => null);

                    const newDescription = description.includes(' <@!') ?
                        description.replace(/<@!(\d+)>/, `<@$1>`) :
                        description.replace(/<@(\d+)>/, `<@!$1>`);

                    const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription + ' ');
                    await message.edit({ embeds: [newEmbed] });
                    fixedCount++;
                } catch (error) {
                    console.error(`Erreur fix message ${message.id}:`, error);
                }
            }
        }

        return interaction.editReply(`✅ Analyse terminée. **${fixedCount}** messages ont été rafraîchis pour corriger les mentions.`);
    },
};
