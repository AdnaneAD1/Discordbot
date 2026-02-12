const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Met en pause ou reprend la musique actuelle'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: MessageFlags.Ephemeral });
        }

        const { isGuildPremium } = require('../../services/subscriptions');
        const { Blackjack } = require('../../systems/casino');
        const isPremium = (await isGuildPremium(interaction.guild.id)).isPremium;

        const COST_PAUSE = 50;

        if (!isPremium) {
            const balance = await Blackjack.getBalance(interaction.user.id);
            if (balance < COST_PAUSE) {
                return interaction.reply({ content: `❌ **Action Payante !**\nMettre en pause/reprendre coûte **${COST_PAUSE}** 🪙.\nTon solde : ${balance} 🪙.`, flags: [64] });
            }
            await Blackjack.updateBalance(interaction.user.id, -COST_PAUSE);
        }

        const isPaused = player.connection.paused;

        if (isPaused) {
            player.connection.setPaused(false);
            return interaction.reply({ content: '▶️ Musique reprise !' });
        } else {
            player.connection.setPaused(true);
            return interaction.reply({ content: '⏸️ Musique mise en pause.' });
        }
    },
};
