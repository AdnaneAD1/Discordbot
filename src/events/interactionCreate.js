const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Command Execution Error:', error);

                // Check if interaction is still valid (less than 15 mins but usually 3s for initial reply)
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true });
                    } else {
                        await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true });
                    }
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError.message);
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_')) {
                const type = interaction.customId.split('_')[1];
                const { createTicket } = require('../systems/tickets');
                const channel = await createTicket(interaction, type);
                await interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, ephemeral: true });
            } else if (interaction.customId === 'close_ticket') {
                const { closeTicket } = require('../systems/tickets');
                await closeTicket(interaction.channel, interaction.user);
            } else if (interaction.customId === 'giveaway_entry') {
                const { handleEntry } = require('../systems/giveaways');
                await handleEntry(interaction);
            }
        }
    }
};
