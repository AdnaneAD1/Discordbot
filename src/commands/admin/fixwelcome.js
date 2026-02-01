const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

            // Regex for any user mention format: <@123> or <@!123>
            const mentionRegex = /<@!?(\d+)>/g;
            const matches = [...description.matchAll(mentionRegex)];

            if (description.includes('Bienvenue') && matches.length > 0) {
                try {
                    let newDescription = description;
                    let hasChanges = false;

                    for (const match of matches) {
                        const fullMatch = match[0]; // <@123> or <@!123>
                        const userId = match[1];    // 123

                        // 1. Force Cache Refresh (Critical!)
                        await interaction.guild.members.fetch(userId).catch(() => null);

                        // 2. Normalize to standard <@ID> format (Removes <@! if present)
                        const standardMention = `<@${userId}>`;

                        // We replace occurrences. Even if it was already correct, 
                        // we might want to force an update.
                        if (fullMatch !== standardMention) {
                            newDescription = newDescription.replace(fullMatch, standardMention);
                            hasChanges = true;
                        }
                    }

                    // 3. Force update even if text is identical (to trigger client re-render with new cache)
                    // We toggle a zero-width space or standard space at the end
                    if (!hasChanges) {
                        if (newDescription.endsWith(' ')) {
                            newDescription = newDescription.trimEnd(); // Remove space
                        } else {
                            newDescription = newDescription + ' '; // Add space
                        }
                    }

                    const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
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
