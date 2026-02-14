const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../services/firebase');
const configCache = require('../../services/configCache');

async function handleWelcomeInteraction(interaction) {
    const { customId, client } = interaction;
    const guildId = interaction.guild.id;
    const welcomeRef = db.collection('guilds').doc(guildId).collection('config').doc('welcome');

    // Helper pour rafraîchir le dashboard
    const refreshDashboard = async () => {
        const welcomeSetup = client.commands.get('welcome-setup');
        if (welcomeSetup) {
            await welcomeSetup.execute(interaction);
        }
    };

    if (interaction.isButton()) {
        switch (customId) {
            case 'welcome_toggle': {
                const doc = await welcomeRef.get();
                const isPremiumCard = doc.data()?.isPremiumCard || false;
                await welcomeRef.set({ isPremiumCard: !isPremiumCard }, { merge: true });
                configCache.invalidate(guildId, 'welcome');
                return refreshDashboard();
            }

            case 'welcome_edit_text': {
                const doc = await welcomeRef.get();
                const welcomeConfig = doc.data() || {};

                const modal = new ModalBuilder()
                    .setCustomId('welcome_message_modal')
                    .setTitle('Personnaliser les textes');

                const titleInput = new TextInputBuilder()
                    .setCustomId('welcome_title')
                    .setLabel('Titre (ex: BIENVENUE)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(30)
                    .setRequired(false)
                    .setValue(welcomeConfig.titleText || 'BIENVENUE')
                    .setPlaceholder('BIENVENUE');

                const messageInput = new TextInputBuilder()
                    .setCustomId('welcome_message')
                    .setLabel('Message ({user}, {server})')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
                    .setValue(welcomeConfig.messageText || 'Bienvenue sur le serveur !')
                    .setPlaceholder('Bienvenue {user} !');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(messageInput)
                );
                return interaction.showModal(modal);
            }

            case 'welcome_edit_bg': {
                const { getAvailableBackgrounds } = require('../../services/welcomeCard');
                const backgrounds = getAvailableBackgrounds().filter(bg => bg.id !== 'custom');
                const doc = await welcomeRef.get();
                const currentBg = doc.data()?.backgroundId || 'default';

                const select = new StringSelectMenuBuilder()
                    .setCustomId('welcome_background_select')
                    .setPlaceholder('Choisir un background...')
                    .addOptions(backgrounds.map(bg => ({
                        label: bg.name,
                        value: bg.id,
                        default: currentBg === bg.id
                    })));

                const uploadBtn = new ButtonBuilder()
                    .setCustomId('welcome_edit_bg_upload')
                    .setLabel('Uploader mon image')
                    .setEmoji('📤')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(select);
                const row2 = new ActionRowBuilder().addComponents(uploadBtn);

                return interaction.reply({
                    content: '🎨 **Choisis un background ou upload le tien :**',
                    components: [row, row2],
                    flags: [64]
                });
            }

            case 'welcome_edit_font': {
                const { SUPPORTED_FONTS } = require('../../services/welcomeCard');
                const doc = await welcomeRef.get();
                const currentFont = doc.data()?.fontFamily || 'Arial';

                const select = new StringSelectMenuBuilder()
                    .setCustomId('welcome_font_select')
                    .setPlaceholder('Choisir une police...')
                    .addOptions(Object.keys(SUPPORTED_FONTS).map(font => ({
                        label: font,
                        value: font,
                        default: currentFont === font
                    })));

                const row = new ActionRowBuilder().addComponents(select);
                return interaction.reply({
                    content: '🔤 **Choisis une police d\'écriture :**',
                    components: [row],
                    flags: [64]
                });
            }

            case 'welcome_edit_bg_upload': {
                const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;

                await interaction.reply({
                    content: '📤 **Envoie l\'image que tu souhaites utiliser comme background.**\n(Le format recommandé est **1024x450**. L\'image doit être envoyée dans ce salon.)',
                    flags: [64]
                });

                try {
                    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
                    const message = collected.first();
                    const attachment = message.attachments.first();

                    if (!attachment.contentType?.startsWith('image/')) {
                        return interaction.followUp({ content: '❌ Le fichier envoyé n\'est pas une image valide.', flags: [64] });
                    }

                    await welcomeRef.set({
                        backgroundId: 'custom',
                        customBackgroundUrl: attachment.url
                    }, { merge: true });

                    configCache.invalidate(guildId, 'welcome');

                    await interaction.followUp({ content: '✅ **Background personnalisé appliqué !** Mise à jour du dashboard...', flags: [64] });

                    // On essaie de supprimer le message de l'utilisateur pour garder le salon propre
                    try { await message.delete(); } catch (e) { }

                    return refreshDashboard();

                } catch (e) {
                    return interaction.followUp({ content: '⏱️ **Temps écoulé.** Aucune image n\'a été reçue.', flags: [64] });
                }
            }

            case 'welcome_refresh': {
                return refreshDashboard();
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        if (customId === 'welcome_background_select') {
            await welcomeRef.set({ backgroundId: interaction.values[0] }, { merge: true });
            configCache.invalidate(guildId, 'welcome');
            await interaction.deferUpdate();
            return refreshDashboard();
        }

        if (customId === 'welcome_font_select') {
            await welcomeRef.set({ fontFamily: interaction.values[0] }, { merge: true });
            configCache.invalidate(guildId, 'welcome');
            await interaction.deferUpdate();
            return refreshDashboard();
        }

    } else if (interaction.isModalSubmit()) {
        if (customId === 'welcome_message_modal') {
            const titleText = interaction.fields.getTextInputValue('welcome_title') || 'BIENVENUE';
            const messageText = interaction.fields.getTextInputValue('welcome_message') || 'Bienvenue sur le serveur !';

            await welcomeRef.set({ titleText, messageText }, { merge: true });
            configCache.invalidate(guildId, 'welcome');

            await interaction.deferUpdate();
            return refreshDashboard();
        }
    }
}

module.exports = { handleWelcomeInteraction };
