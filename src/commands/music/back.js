const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer, playTrack } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Rejoue le morceau précédent'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);

        if (!player) {
            return interaction.reply({ content: '❌ Aucun morceau n\'est en cours de lecture.', flags: MessageFlags.Ephemeral });
        }

        const { isGuildPremium } = require('../../services/subscriptions');
        const { Blackjack } = require('../../systems/casino');
        const isPremium = (await isGuildPremium(interaction.guild.id)).isPremium;
        const COST_BACK = 50;

        if (!isPremium) {
            const balance = await Blackjack.getBalance(interaction.user.id);
            if (balance < COST_BACK) {
                return interaction.reply({
                    content: `❌ **Solde Insuffisant !**\nRevenir en arrière coûte **${COST_BACK}** 🪙.\nTon solde actuel : **${balance}** 🪙. Recharges tes jetons pour continuer !`,
                    flags: MessageFlags.Ephemeral
                });
            }
            await Blackjack.updateBalance(interaction.user.id, -COST_BACK);
        }

        const prevTrack = player.previousTrack();
        if (!prevTrack) {
            return interaction.reply({ content: '❌ Pas de morceau précédent dans l\'historique.', flags: MessageFlags.Ephemeral });
        }

        await playTrack(player, prevTrack);
        return interaction.reply({ content: '⏪ Retour au morceau précédent !' });
    },
};
