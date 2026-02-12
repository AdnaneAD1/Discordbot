const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
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

                const row = new ActionRowBuilder().addComponents(select);
                return interaction.reply({
                    content: '🎨 **Choisis un background :**',
                    components: [row],
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
