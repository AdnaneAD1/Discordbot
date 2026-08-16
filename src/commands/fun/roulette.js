const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Roulette, Blackjack } = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Joue à la Roulette (Mise x2 ou x36) !')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('La somme à parier')
                .setRequired(true)
                .setMinValue(10))
        .addStringOption(option =>
            option.setName('pari')
                .setDescription('Sur quoi parier ? (Rouge/Noir, Pair/Impair, ou un Numéro 0-36)')
                .setRequired(true)),

    async execute(interaction) {
        const bet = interaction.options.getInteger('mise');
        const rawBetValue = interaction.options.getString('pari').toLowerCase();
        const userId = interaction.user.id;

        // 1. Validation de la Mise
        const currentBalance = await Blackjack.getBalance(userId);
        if (currentBalance < bet) {
            return interaction.reply({ content: `❌ T'es fauché ! Il te faut **${bet}** 🪙 (Solde: ${currentBalance})`, flags: [64] });
        }

        // 2. Parsage du Pari
        let betType = 'number';
        let betValue = rawBetValue;

        if (['rouge', 'red', '🔴'].includes(rawBetValue)) { betType = 'color'; betValue = 'red'; }
        else if (['noir', 'black', '⚫'].includes(rawBetValue)) { betType = 'color'; betValue = 'black'; }
        else if (['vert', 'green', '🟢'].includes(rawBetValue)) { betType = 'number'; betValue = '0'; } // 0 est traité comme un chiffre
        else if (['pair', 'even'].includes(rawBetValue)) { betType = 'parity'; betValue = 'even'; }
        else if (['impair', 'odd'].includes(rawBetValue)) { betType = 'parity'; betValue = 'odd'; }
        else {
            // Vérifier si c'est un numéro valide
            const number = parseInt(rawBetValue);
            if (isNaN(number) || number < 0 || number > 36) {
                return interaction.reply({ content: '❌ Pari invalide ! Mise sur **Rouge**, **Noir**, **Pair**, **Impair** ou un nombre **0-36**.', flags: [64] });
            }
            betValue = number.toString();
        }

        // 3. Animation du Spin
        await Blackjack.updateBalance(userId, -bet); // Prélèvement immédiat

        const spinEmbed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle('🎰 La Roulette tourne...')
            .setDescription(`Tu as misé **${bet}** 🪙 sur **${rawBetValue.toUpperCase()}**.\n\n🎲 *La bille saute...*`)
            .setImage('https://media1.tenor.com/m/K2G1t7pC2cAAAAAC/roulette-casino.gif'); // GIF d'attente

        await interaction.reply({ embeds: [spinEmbed] });

        // Petit délai pour le suspens (3s)
        setTimeout(async () => {
            // 4. Résultat
            const resultNumber = Roulette.spin();
            const resultColor = Roulette.getColor(resultNumber);
            const resultEmoji = Roulette.getEmoji(resultNumber);

            const multiplier = Roulette.calculatePayout(betType, betValue, resultNumber);
            const payout = bet * multiplier;
            const profit = payout - bet; // Si perdu, profit = -bet (déjà prélevé)

            // Si gagné, on rend la mise + le gain (payout)
            if (multiplier > 0) {
                await Blackjack.updateBalance(userId, payout);
            }

            const newBalance = await Blackjack.getBalance(userId);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`🎰 RÉSULTAT : ${resultEmoji} ${resultNumber} ${resultColor.toUpperCase()}`)
                .setColor(multiplier > 0 ? '#00b894' : '#d63031')
                .setThumbnail(multiplier > 0 ? 'https://cdn-icons-png.flaticon.com/512/7508/7508614.png' : 'https://cdn-icons-png.flaticon.com/512/10080/10080336.png')
                .setDescription(`La bille s'est arrêtée sur le **${resultNumber}** (${resultEmoji}).`)
                .addFields(
                    { name: '✨ Ton Pari', value: `**${rawBetValue.toUpperCase()}**`, inline: true },
                    { name: multiplier > 0 ? '💰 Profit' : '💸 Perte', value: multiplier > 0 ? `**+${profit}** 🪙 (x${multiplier})` : `**-${bet}** 🪙`, inline: true },
                    { name: '👛 Nouveau Solde', value: `**${newBalance}** 🪙`, inline: true }
                )
                .setFooter({ text: 'Casino • Bonne chance pour la prochaine !' });

            await interaction.editReply({ embeds: [resultEmbed] });

        }, 3500);
    },
};
