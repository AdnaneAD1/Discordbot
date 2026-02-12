const { db } = require('../../services/firebase');
const configCache = require('../../services/configCache');

async function handleWelcomeInteraction(interaction) {
    const { customId } = interaction;
    const guildId = interaction.guild.id;
    const welcomeRef = db.collection('guilds').doc(guildId).collection('config').doc('welcome');

    if (interaction.isStringSelectMenu()) {
        if (customId === 'welcome_background_select') {
            const selectedBg = interaction.values[0];

            await welcomeRef.set({ backgroundId: selectedBg }, { merge: true });
            configCache.invalidate(guildId, 'welcome');

            await interaction.reply({
                content: `✅ Background mis à jour : **${selectedBg}**\n\nUtilise \`/welcome-setup preview\` pour voir le résultat.`,
                flags: [64]
            });
        }
    } else if (interaction.isModalSubmit()) {
        if (customId === 'welcome_message_modal') {
            const titleText = interaction.fields.getTextInputValue('welcome_title') || 'BIENVENUE';
            const messageText = interaction.fields.getTextInputValue('welcome_message') || 'Bienvenue sur le serveur !';

            await welcomeRef.set({ titleText, messageText }, { merge: true });
            configCache.invalidate(guildId, 'welcome');

            await interaction.reply({
                content: `✅ **Textes mis à jour !**\n\n📝 **Titre :** ${titleText}\n💬 **Message :** ${messageText}\n\nUtilise \`/welcome-setup preview\` pour voir le résultat.`,
                flags: [64]
            });
        }
    }
}

module.exports = { handleWelcomeInteraction };
