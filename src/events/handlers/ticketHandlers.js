async function handleTicketInteraction(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('ticket_')) {
        const type = customId.split('_')[1];
        const { createTicket } = require('../../systems/tickets');
        const channel = await createTicket(interaction, type);
        await interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, flags: [64] });
    } else if (customId === 'close_ticket') {
        await interaction.deferUpdate(); // Acknowledge interaction before async delete
        const { closeTicket } = require('../../systems/tickets');
        await closeTicket(interaction.channel, interaction.user);
    }
}

module.exports = { handleTicketInteraction };
