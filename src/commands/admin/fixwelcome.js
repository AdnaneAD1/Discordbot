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
            // Analyser tout message de bot avec embed OU attachment (Card Image)
            if (!message.author.bot) continue;
            const hasEmbed = message.embeds.length > 0;
            const hasAttachment = message.attachments.size > 0;

            if (!hasEmbed && !hasAttachment) continue;
            botMessagesFound++;

            let embed = hasEmbed ? message.embeds[0] : null;
            let description = embed?.description || '';
            let title = embed?.title || '';
            let content = message.content || '';

            const fullTextForSearch = (title + description + content).toLowerCase();

            // Regex pour capturer l'ID de n'importe quelle mention
            const mentionRegex = /<@!?(\d+)>/g;

            // On cherche les mentions PARTOUT pour identifier le membre concerné
            const matchesInEmbed = [...(title + description).matchAll(mentionRegex)];
            const matchesInContent = [...content.matchAll(mentionRegex)];
            const allMatches = [...matchesInEmbed, ...matchesInContent];

            if ((fullTextForSearch.includes('bienvenue') || fullTextForSearch.includes('welcome')) && allMatches.length > 0) {
                try {
                    let newDescription = description;
                    let hasResolvedForThisMessage = false;
                    const resolvedMemberIds = new Set();

                    // 1. Résolution des membres
                    for (const match of allMatches) {
                        const userId = match[1];
                        if (resolvedMemberIds.has(userId)) continue;

                        try {
                            const member = await interaction.guild.members.fetch(userId);
                            if (member) {
                                membersResolved++;
                                resolvedMemberIds.add(userId);
                                // Dans l'embed, on remplace par le pseudo en gras (Nouveau Welcome Style)
                                newDescription = newDescription.replaceAll(match[0], `**${member.displayName}**`);
                                hasResolvedForThisMessage = true;
                            }
                        } catch (e) {
                            membersNotFound++;
                            console.log(`[FixWelcome] Membre ${userId} introuvable.`);
                        }
                    }

                    // 2. TRIGGER UPDATE : Mention dans le content + Embed nettoyé
                    if (hasResolvedForThisMessage || (hasAttachment && matchesInContent.length > 0)) {
                        const firstMentionId = Array.from(resolvedMemberIds)[0] || allMatches[0][1];

                        // Petit toggle invisible pour forcer le refresh
                        if (newDescription.includes('\u200b')) {
                            newDescription = newDescription.replace(/\u200b/g, '');
                        } else {
                            newDescription = newDescription + '\u200b';
                        }

                        const updatePayload = { content: `<@${firstMentionId}>` };
                        if (hasEmbed) {
                            updatePayload.embeds = [EmbedBuilder.from(embed).setDescription(newDescription)];
                        }

                        await message.edit(updatePayload);
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
