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
        let membersResolved = 0;
        let membersNotFound = 0;

        for (const message of messages.values()) {
            // Analyser tout message de bot avec embed
            if (!message.author.bot || message.embeds.length === 0) continue;
            botMessagesFound++;

            const embed = message.embeds[0];
            const title = embed.title || '';
            const description = embed.description || '';
            const fullText = (title + description).toLowerCase();

            // Regex pour capturer l'ID de n'importe quelle mention
            const mentionRegex = /<@!?(\d+)>/g;
            const matches = [...description.matchAll(mentionRegex)];

            if ((fullText.includes('bienvenue') || fullText.includes('welcome')) && matches.length > 0) {
                try {
                    let newDescription = description;
                    let hasResolvedForThisMessage = false;

                    for (const match of matches) {
                        const userId = match[1];

                        // 1. Fetch FORCÉ depuis l'API (pas seulement le cache)
                        try {
                            const member = await interaction.guild.members.fetch(userId);
                            if (member) {
                                membersResolved++;
                                // Remplacer la mention par le nom d'affichage en gras
                                newDescription = newDescription.replaceAll(match[0], `**${member.displayName}**`);
                                hasResolvedForThisMessage = true;
                            }
                        } catch (e) {
                            membersNotFound++;
                            console.log(`[FixWelcome] Membre ${userId} introuvable (quitté).`);
                        }
                    }

                    // 2. TRIGGER RE-RENDER : Toggling invisible character + adding content mention
                    if (hasResolvedForThisMessage) {
                        // Extraire le premier ID résolu pour le contenu du message (force le client à parser)
                        const firstMentionId = matches[0][1];

                        if (newDescription.includes('\u200b')) {
                            newDescription = newDescription.replace(/\u200b/g, '');
                        } else {
                            newDescription = newDescription + '\u200b';
                        }

                        const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription);
                        await message.edit({ content: `<@${firstMentionId}>`, embeds: [newEmbed] });
                        fixedCount++;
                    }
                } catch (error) {
                    console.error(`[FixWelcome] Erreur sur message ${message.id}:`, error);
                }
            }
        }

        return interaction.editReply(`✅ **Analyse terminée sur les ${messages.size} derniers messages de <#${welcomeChannelId}>.**\n\n` +
            `• Messages de bots trouvés : \`${botMessagesFound}\`\n` +
            `• Messages de bienvenue rafraîchis : \`${fixedCount}\`\n` +
            `• Mentions résolues (membres présents) : \`${membersResolved}\`\n` +
            `• Mentions inconnues (membres partis) : \`${membersNotFound}\`\n\n` +
            `*Si les pseudos ne s'affichent toujours pas pour les membres présents, il s'agit d'un délai de cache Discord.*`);
    },
};
