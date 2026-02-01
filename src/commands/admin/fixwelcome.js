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
            return interaction.editReply('❌ Aucun salon de bienvenue n\'est configuré dans la base de données.');
        }

        const channel = interaction.guild.channels.cache.get(welcomeChannelId);
        if (!channel) {
            return interaction.editReply(`❌ Le salon de bienvenue (<#${welcomeChannelId}>) est introuvable ou inaccessible.`);
        }

        // 2. Chercher les messages
        const messages = await channel.messages.fetch({ limit });
        let fixedCount = 0;
        let botMessagesFound = 0;

        for (const message of messages.values()) {
            // Check if it's a bot message (accept any bot for the fix command)
            if (!message.author.bot || message.embeds.length === 0) continue;
            botMessagesFound++;

            const embed = message.embeds[0];
            const title = embed.title || '';
            const description = embed.description || '';
            const fullText = (title + description).toLowerCase();

            // Regex for any user mention format: <@123> or <@!123>
            const mentionRegex = /<@!?(\d+)>/g;
            const matches = [...description.matchAll(mentionRegex)];

            // Match "bienvenue" or "welcome" (case insensitive)
            if ((fullText.includes('bienvenue') || fullText.includes('welcome')) && matches.length > 0) {
                try {
                    let newDescription = description;
                    let hasChanges = false;

                    for (const match of matches) {
                        const fullMatch = match[0];
                        const userId = match[1];

                        // 1. Force Cache Refresh
                        await interaction.guild.members.fetch(userId).catch(() => null);

                        // 2. Normalize to standard <@ID>
                        const standardMention = `<@${userId}>`;

                        if (fullMatch !== standardMention) {
                            newDescription = newDescription.replaceAll(fullMatch, standardMention);
                            hasChanges = true;
                        }
                    }

                    // 3. Force update (toggle space)
                    if (newDescription.endsWith(' ')) {
                        newDescription = newDescription.slice(0, -1);
                    } else {
                        newDescription = newDescription + ' ';
                    }

                    const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
                    await message.edit({ embeds: [newEmbed] });
                    fixedCount++;
                } catch (error) {
                    console.error(`[FixWelcome] Erreur sur message ${message.id}:`, error);
                }
            }
        }

        return interaction.editReply(`✅ Analyse terminée sur les **${messages.size}** derniers messages de <#${welcomeChannelId}>.\n- Messages de bots trouvés : **${botMessagesFound}**\n- Messages de bienvenue rafraîchis : **${fixedCount}**`);
    },
};
