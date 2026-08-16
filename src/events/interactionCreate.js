const { Events, ChannelType } = require('discord.js');
const { handleWerewolfInteraction } = require('./handlers/werewolfHandlers');
const { handleMusicInteraction } = require('./handlers/musicHandlers');
const { handleProfileInteraction } = require('./handlers/profileHandlers');
const { handleImageInteraction } = require('./handlers/imageHandlers');
const { handleTicketInteraction } = require('./handlers/ticketHandlers');
const { handleWelcomeInteraction } = require('./handlers/welcomeHandlers');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            // --- Music Channel Restriction ---
            const musicCommands = ['play', 'pause', 'skip', 'stop', 'back', 'loop', 'queue', 'nowplaying'];
            if (musicCommands.includes(interaction.commandName)) {
                const configCache = require('../services/configCache');
                const channelConfig = await configCache.getConfig(interaction.guild.id, 'channels');
                if (channelConfig) {
                    const musicTextChannelId = channelConfig.musicTextChannelId;
                    const isVoiceChat = interaction.channel.type === ChannelType.GuildVoice;

                    if (musicTextChannelId && interaction.channelId !== musicTextChannelId && !isVoiceChat) {
                        return interaction.reply({
                            content: `❌ Les commandes de musique doivent être utilisées dans le salon <#${musicTextChannelId}> ou dans le chat de ton salon vocal.`,
                            flags: [64]
                        });
                    }
                }
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Command Execution Error:', error);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
                    } else {
                        await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', flags: [64] });
                    }
                } catch (e) { }
            }
        }

        // --- Modular Handlers ---
        else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            const { customId } = interaction;
            if (!customId) return;

            try {
                if (customId.startsWith('lg_')) {
                    await handleWerewolfInteraction(interaction);
                } else if (customId.startsWith('music_')) {
                    await handleMusicInteraction(interaction);
                } else if (customId.startsWith('profile_')) {
                    await handleProfileInteraction(interaction);
                } else if (customId.startsWith('imagine_')) {
                    await handleImageInteraction(interaction);
                } else if (customId.startsWith('ticket_') || customId === 'close_ticket') {
                    await handleTicketInteraction(interaction);
                } else if (customId === 'giveaway_entry') {
                    const { handleEntry } = require('../systems/giveaways');
                    await handleEntry(interaction);
                } else if (customId === 'open_shop_from_info') {
                    await interaction.reply({ content: '🪙 Le bot est désormais 100% gratuit et Open Source ! Toutes les fonctionnalités premium sont débloquées par défaut.', flags: [64] });
                } else if (customId.startsWith('welcome_')) {
                    await handleWelcomeInteraction(interaction);
                }
            } catch (error) {
                console.error(`Interaction Handler Error (${customId}):`, error);
                try {
                    const reply = { content: '❌ Une erreur est survenue lors du traitement de l\'interaction.', flags: [64] };
                    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
                    else await interaction.reply(reply);
                } catch (e) { }
            }
        }
    }
};
