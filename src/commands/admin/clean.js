const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clean')
        .setDescription('Supprime tous les messages du salon actuel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('limite')
                .setDescription('Nombre maximum de messages à supprimer (défaut: tous, max: 1000)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000))
        .addBooleanOption(option =>
            option.setName('confirmer')
                .setDescription('Confirmer la suppression sans demande de confirmation')
                .setRequired(false)),

    async execute(interaction) {
        const limite = interaction.options.getInteger('limite') || 1000;
        const confirmer = interaction.options.getBoolean('confirmer') || false;

        // Vérifier les permissions du bot
        if (!interaction.channel.permissionsFor(interaction.guild.members.me).has(['ManageMessages', 'ReadMessageHistory'])) {
            return interaction.reply({
                content: '❌ Je n\'ai pas les permissions nécessaires (Gérer les messages, Lire l\'historique).',
                flags: [64]
            });
        }

        // Demande de confirmation si non spécifiée
        if (!confirmer) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Confirmation requise')
                .setDescription(`Vous êtes sur le point de supprimer **jusqu'à ${limite} messages** dans ce salon.\n\nCette action est **irréversible**.`)
                .setColor('#e74c3c')
                .setFooter({ text: 'Cette confirmation expire dans 30 secondes' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('clean_confirm')
                        .setLabel('Confirmer la suppression')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️'),
                    new ButtonBuilder()
                        .setCustomId('clean_cancel')
                        .setLabel('Annuler')
                        .setStyle(ButtonStyle.Secondary)
                );

            const confirmMessage = await interaction.reply({
                embeds: [confirmEmbed],
                components: [row],
                fetchReply: true
            });

            try {
                const buttonInteraction = await confirmMessage.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id,
                    time: 30000
                });

                if (buttonInteraction.customId === 'clean_cancel') {
                    return buttonInteraction.update({
                        content: '❌ Suppression annulée.',
                        embeds: [],
                        components: []
                    });
                }

                // Supprimer le message de confirmation
                await buttonInteraction.update({
                    content: '🔄 Suppression en cours...',
                    embeds: [],
                    components: []
                });

            } catch (error) {
                return interaction.editReply({
                    content: '⏱️ Temps écoulé. Suppression annulée.',
                    embeds: [],
                    components: []
                });
            }
        } else {
            await interaction.reply({
                content: '🔄 Suppression en cours...',
                flags: [64]
            });
        }

        // Processus de suppression
        let totalDeleted = 0;
        let hasMore = true;

        try {
            while (hasMore && totalDeleted < limite) {
                const toFetch = Math.min(100, limite - totalDeleted);
                const messages = await interaction.channel.messages.fetch({ limit: toFetch });

                if (messages.size === 0) {
                    hasMore = false;
                    break;
                }

                // Filtrer les messages de plus de 14 jours (limite Discord)
                const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                const deletableMessages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);
                const oldMessages = messages.filter(m => m.createdTimestamp <= twoWeeksAgo);

                // Supprimer les messages récents en bulk
                if (deletableMessages.size > 0) {
                    try {
                        const deleted = await interaction.channel.bulkDelete(deletableMessages, true);
                        totalDeleted += deleted.size;
                    } catch (e) {
                        console.error('Erreur bulk delete:', e.message);
                    }
                }

                // Supprimer les vieux messages un par un (plus lent mais nécessaire)
                for (const [, msg] of oldMessages) {
                    if (totalDeleted >= limite) break;
                    try {
                        await msg.delete();
                        totalDeleted++;
                        // Petit délai pour éviter le rate limit
                        await new Promise(r => setTimeout(r, 100));
                    } catch (e) {
                        // Message déjà supprimé ou autre erreur
                    }
                }

                // Si on a récupéré moins de messages que demandé, c'est qu'il n'y en a plus
                if (messages.size < toFetch) {
                    hasMore = false;
                }

                // Petit délai entre les batches
                await new Promise(r => setTimeout(r, 1000));
            }

            // Message de confirmation
            const resultEmbed = new EmbedBuilder()
                .setTitle('🧹 Nettoyage terminé')
                .setDescription(`**${totalDeleted}** message(s) supprimé(s) dans ce salon.`)
                .setColor('#2ecc71')
                .setFooter({ text: `Par ${interaction.user.username}` })
                .setTimestamp();

            const finalMessage = await interaction.channel.send({ embeds: [resultEmbed] });

            // Auto-supprimer le message de confirmation après 10 secondes
            setTimeout(() => {
                finalMessage.delete().catch(() => {});
            }, 10000);

        } catch (error) {
            console.error('Erreur lors du nettoyage:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription(`Une erreur est survenue après avoir supprimé **${totalDeleted}** message(s).\n\`\`\`${error.message}\`\`\``)
                .setColor('#e74c3c');

            await interaction.channel.send({ embeds: [errorEmbed] });
        }
    }
};
