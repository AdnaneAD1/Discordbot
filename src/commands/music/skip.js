const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getExistingPlayer } = require('../../services/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Passe à la musique suivante'),
    async execute(interaction) {
        const player = getExistingPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Il n\'y a pas de musique en cours.', flags: MessageFlags.Ephemeral });
        }

        const { isGuildPremium } = require('../../services/subscriptions');
        const { Blackjack } = require('../../systems/casino');
        const isPremium = (await isGuildPremium(interaction.guild.id)).isPremium;

        const COST_SKIP = 100;

        if (!isPremium) {
            const balance = await Blackjack.getBalance(interaction.user.id);
            if (balance < COST_SKIP) {
                return interaction.reply({ content: `❌ **Action Payante !**\nPasser un morceau coûte **${COST_SKIP}** 🪙.\nTon solde : ${balance} 🪙.`, flags: [64] });
            }
            await Blackjack.updateBalance(interaction.user.id, -COST_SKIP);
        }

        // Stopper la piste actuelle, le handler 'end' jouera la suivante
        player.connection.stopTrack();
        await interaction.reply('⏭️ Musique passée !');
    },
};
