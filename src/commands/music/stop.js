const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer, destroyPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Arrête la musique et fait partir le bot'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: MessageFlags.Ephemeral });
        }

        const { isGuildPremium } = require('../../services/subscriptions');
        const { Blackjack } = require('../../systems/casino');
        const isPremium = (await isGuildPremium(interaction.guild.id)).isPremium;
        const COST_STOP = 50;

        if (!isPremium) {
            const balance = await Blackjack.getBalance(interaction.user.id);
            if (balance < COST_STOP) {
                return interaction.reply({
                    content: `❌ **Solde Insuffisant !**\nArrêter la musique coûte **${COST_STOP}** 🪙.\nTon solde actuel : **${balance}** 🪙. Recharges tes jetons pour continuer !`,
                    flags: MessageFlags.Ephemeral
                });
            }
            await Blackjack.updateBalance(interaction.user.id, -COST_STOP);
        }

        destroyPlayer(interaction.guild.id);
        await interaction.reply('🛑 Musique arrêtée et bot déconnecté.');
    },
};
