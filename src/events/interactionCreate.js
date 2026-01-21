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
                        await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
                    } else {
                        await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
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
                await interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, flags: [64] });
            } else if (interaction.customId === 'close_ticket') {
                const { closeTicket } = require('../systems/tickets');
                await closeTicket(interaction.channel, interaction.user);
            } else if (interaction.customId === 'giveaway_entry') {
                const { handleEntry } = require('../systems/giveaways');
                await handleEntry(interaction);
            } else if (interaction.customId.startsWith('music_')) {
                const { kazagumo } = interaction.client;
                const player = kazagumo.players.get(interaction.guild.id);

                if (!player) return interaction.reply({ content: '❌ Plus de musique en cours.', flags: [64] });

                const action = interaction.customId.replace('music_', '');

                switch (action) {
                    case 'back':
                        if (!player.queue.previous) return interaction.reply({ content: '❌ Pas de morceau précédent.', flags: [64] });
                        player.queue.unshift(player.queue.previous);
                        player.skip();
                        await interaction.reply({ content: '⏪ Retour au morceau précédent !', flags: [64] });
                        break;
                    case 'loop':
                        // Kazagumo loop modes: 'none', 'track', 'queue'
                        let newLoop = 'none';
                        if (player.loop === 'none') newLoop = 'track';
                        else if (player.loop === 'track') newLoop = 'queue';

                        player.setLoop(newLoop);
                        const loopMessages = { 'none': 'désactivée', 'track': 'du morceau actuel', 'queue': 'de la file d\'attente' };
                        await interaction.reply({ content: `🔁 Répétition **${loopMessages[newLoop]}** !`, flags: [64] });
                        break;
                    case 'pause':
                        player.pause(!player.paused);
                        await interaction.reply({ content: player.paused ? '⏸️ Musique en pause' : '▶️ Musique reprise', flags: [64] });
                        break;
                    case 'stop':
                        player.destroy();
                        await interaction.reply({ content: '⏹️ Musique arrêtée et file nettoyée.', flags: [64] });
                        break;
                    case 'skip':
                        player.skip();
                        await interaction.reply({ content: '⏭️ Morceau suivant !', flags: [64] });
                        break;
                }
            }
        }
    }
};
