const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const { isGuildPremium } = require('../../services/subscriptions');
const { generateWelcomeCard } = require('../../services/welcomeCard');
const configCache = require('../../services/configCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome-setup')
        .setDescription('Ouvre le panneau de configuration Welcome Premium 🖼️')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // On peut être appelé via la commande slash ou via un bouton de rafraîchissement
        const isInitial = interaction.isChatInputCommand();
        if (isInitial) await interaction.deferReply({ flags: [64] });

        try {
            // Vérifier si le serveur est premium
            const premiumStatus = await isGuildPremium(guildId);
            if (!premiumStatus.isPremium) {
                const reply = {
                    content: '⭐ Cette fonctionnalité nécessite un abonnement **Premium**.\nUn membre premium peut activer ses avantages sur ce serveur via `/premium activate`.',
                    flags: [64]
                };
                return isInitial ? interaction.editReply(reply) : interaction.reply(reply);
            }

            const welcomeRef = db.collection('guilds').doc(guildId).collection('config').doc('welcome');
            const welcomeConfig = (await welcomeRef.get()).data() || {};

            // Générer l'aperçu
            const imageBuffer = await generateWelcomeCard(interaction.member, welcomeConfig);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome_preview.png' });

            const dashboardEmbed = new EmbedBuilder()
                .setTitle('🖼️ CONFIGURATION WELCOME CARD')
                .setColor(welcomeConfig.isPremiumCard ? '#2ecc71' : '#f39c12')
                .setDescription('Personnalise l\'image de bienvenue pour tes nouveaux membres. Les modifications sont visibles instantanément sur l\'aperçu ci-dessous.')
                .addFields(
                    { name: '📌 État', value: welcomeConfig.isPremiumCard ? '✅ **Activé**' : '❌ **Désactivé**', inline: true },
                    { name: '🎨 Fond', value: `\`${welcomeConfig.backgroundId || 'default'}\``, inline: true },
                    { name: '🔤 Police', value: `\`${welcomeConfig.fontFamily || 'Arial'}\``, inline: true }
                )
                .setImage('attachment://welcome_preview.png')
                .setFooter({ text: '💡 Utilise les boutons ci-dessous pour configurer ton dashboard.' });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('welcome_toggle')
                    .setLabel(welcomeConfig.isPremiumCard ? 'Désactiver' : 'Activer')
                    .setStyle(welcomeConfig.isPremiumCard ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('welcome_edit_text')
                    .setLabel('Modifier Textes')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('welcome_refresh')
                    .setLabel('Rafraîchir')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('welcome_edit_bg')
                    .setLabel('Changer Background')
                    .setEmoji('🎨')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('welcome_edit_font')
                    .setLabel('Changer Police')
                    .setEmoji('🔤')
                    .setStyle(ButtonStyle.Secondary)
            );

            const payload = {
                embeds: [dashboardEmbed],
                files: [attachment],
                components: [row1, row2],
                flags: [64]
            };

            if (isInitial) {
                await interaction.editReply(payload);
            } else {
                // Pour les updates venant des handlers
                await interaction.editReply(payload);
            }

        } catch (error) {
            console.error('[WelcomeSetup] Erreur dashboard:', error);
            const errorReply = { content: '❌ Erreur lors de l\'ouverture du panneau de configuration.' };
            return isInitial ? interaction.editReply(errorReply) : interaction.followUp(errorReply);
        }
    }
};
