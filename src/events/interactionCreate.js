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
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'accept_rules') {
                const { acceptRules } = require('../systems/regulation');
                const success = await acceptRules(interaction.member);

                if (success) {
                    await interaction.reply({ content: '✅ Vous avez accepté le règlement ! Accès accordé.', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'acceptation du règlement. Contactez un administrateur.', ephemeral: true });
                }
            } else if (interaction.customId.startsWith('ticket_')) {
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
    },
};
