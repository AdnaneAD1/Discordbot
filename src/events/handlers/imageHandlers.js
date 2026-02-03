async function handleImageInteraction(interaction) {
    const { customId } = interaction;
    const userId = customId.split('_')[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Seul l\'auteur peut effectuer cette action.', flags: [64] });
    }

    if (customId.startsWith('imagine_regenerate_')) {
        const cache = interaction.client.imageCache?.get(userId);
        if (!cache) return interaction.reply({ content: '❌ Données de régénération expirées.', flags: [64] });

        const imageCooldown = require('../../systems/imageCooldown');
        const cooldownCheck = await imageCooldown.checkCooldown(interaction.guild.id, userId);
        if (!cooldownCheck.allowed) {
            return interaction.reply({
                content: `⏱️ Tu as atteint la limite. Réessaye dans **${cooldownCheck.resetIn} minute(s)**.`,
                flags: [64]
            });
        }

        await interaction.deferUpdate();
        const command = interaction.client.commands.get('imagine');
        if (command) {
            interaction.options = {
                getString: (name) => name === 'prompt' ? cache.prompt : cache.style,
                getBoolean: () => false
            };
            await command.execute(interaction);
        }
    } else if (customId.startsWith('imagine_delete_')) {
        await interaction.message.delete();
        await interaction.reply({ content: '🗑️ Image supprimée.', flags: [64] });
    }
}

module.exports = { handleImageInteraction };
