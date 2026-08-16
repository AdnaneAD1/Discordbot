const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { Blackjack } = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Joue au Blackjack au Casino 🎰')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Le montant de jetons à parier')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('mise');

        let balance = await Blackjack.getBalance(userId);
        if (balance < bet) {
            return interaction.reply({ content: `❌ Tu n'as pas assez de jetons ! Solde actuel : **${balance}** 🪙`, flags: [64] });
        }

        // Initialisation du jeu
        const deck = Blackjack.createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const getEmbed = (isGameOver = false) => {
            const playerScore = Blackjack.calculateScore(playerHand);
            const dealerScore = isGameOver ? Blackjack.calculateScore(dealerHand) : Blackjack.calculateScore([dealerHand[0]]);

            const embed = new EmbedBuilder()
                .setTitle('🃏 BLACKJACK CASINO')
                .setColor(isGameOver ? (playerScore > 21 || (dealerScore <= 21 && dealerScore > playerScore) ? '#ff4d4d' : (playerScore === dealerScore ? '#b2bec3' : '#2ecc71')) : '#febc11')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/10539/10539871.png')
                .addFields(
                    {
                        name: `👤 Ta main (${playerScore})`,
                        value: Blackjack.formatHand(playerHand),
                        inline: true
                    },
                    {
                        name: `🎭 Dealer (${isGameOver ? dealerScore : '??'})`,
                        value: isGameOver
                            ? Blackjack.formatHand(dealerHand)
                            : `${Blackjack.formatHand([dealerHand[0]])} 🎴`,
                        inline: true
                    }
                )
                .setFooter({ text: `💰 Mise: ${bet} 🪙 | Solde: ${balance - bet} 🪙` });

            if (isGameOver) {
                let result = '';
                if (playerScore > 21) result = '💥 **BUST !** Tu as dépassé 21.\nLa maison gagne.';
                else if (dealerScore > 21) result = '🎉 **GAGNÉ !** Le dealer a busté !\nTu remportes la mise.';
                else if (playerScore > dealerScore) result = `🏆 **GAGNÉ !** Ta main est supérieure.\nFélicitations !`;
                else if (playerScore < dealerScore) result = '💀 **PERDU !** Le dealer est plus fort.\nTente encore !';
                else result = '🤝 **MATCH NUL !** Personne ne gagne.\nMise remboursée.';

                embed.setDescription(result);
            }
            return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Tirer (Hit)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Rester (Stand)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bj_double').setLabel('Doubler (x2)').setStyle(ButtonStyle.Danger).setDisabled(balance < bet * 2)
        );

        const response = await interaction.reply({
            embeds: [getEmbed()],
            components: [buttons]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000,
            componentType: ComponentType.Button
        });

        collector.on('collect', async i => {
            if (i.customId === 'bj_hit') {
                playerHand.push(deck.pop());
                const score = Blackjack.calculateScore(playerHand);

                if (score >= 21) {
                    collector.stop(score > 21 ? 'bust' : 'stand');
                } else {
                    await i.update({ embeds: [getEmbed()] });
                }
            } else if (i.customId === 'bj_stand') {
                collector.stop('stand');
            } else if (i.customId === 'bj_double') {
                // TODO: Gérer le double
                collector.stop('double');
            }
        });

        collector.on('end', async (collected, reason) => {
            let finalBet = bet;
            if (reason === 'double') {
                finalBet = bet * 2;
                playerHand.push(deck.pop());
            }

            // Tour du dealer si pas bust
            if (Blackjack.calculateScore(playerHand) <= 21) {
                while (Blackjack.calculateScore(dealerHand) < 17) {
                    dealerHand.push(deck.pop());
                }
            }

            const pScore = Blackjack.calculateScore(playerHand);
            const dScore = Blackjack.calculateScore(dealerHand);

            let payout = 0;
            let tax = 0;
            if (pScore <= 21) {
                if (dScore > 21 || pScore > dScore) {
                    const totalPayout = finalBet * 2;
                    tax = Math.floor(totalPayout * 0.05); // 5% de taxe
                    payout = totalPayout - tax;
                }
                else if (pScore === dScore) payout = finalBet;
            }

            let profit = payout - finalBet;

            // --- Cashback logic ---
            let cashback = 0;
            if (profit < 0) {
                const { getUserSubscription } = require('../../services/subscriptions');
                const sub = await getUserSubscription(userId);
                if (sub.tier.id !== 'free') {
                    cashback = Math.floor(Math.abs(profit) * 0.10); // 10% cashback
                }
            }

            if (cashback > 0) {
                profit += cashback;
            }

            await Blackjack.updateBalance(userId, profit);
            const newBalance = await Blackjack.getBalance(userId);

            const finalEmbed = getEmbed(true);
            let footerText = `Résultat: ${payout - finalBet >= 0 ? '+' : ''}${payout - finalBet} 🪙`;
            if (tax > 0) footerText += ` (Taxe: -${tax} 🪙)`;
            if (cashback > 0) footerText += ` (🛡️ Cashback Premium: +${cashback} 🪙)`;
            footerText += ` | Nouveau solde: ${newBalance} 🪙`;

            finalEmbed.setFooter({ text: footerText });

            if (interaction.replied) {
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
            }
        });
    }
};
