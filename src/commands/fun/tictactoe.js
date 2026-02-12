const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const TicTacToe = require('../../systems/tictactoe');
const { Blackjack } = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Duel de Morpion (Tic-Tac-Toe) !')
        .addUserOption(option =>
            option.setName('adversaire')
                .setDescription('Le joueur à défier')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Mise en jetons (Optionnel, 0 par défaut)')
                .setMinValue(0)),

    async execute(interaction) {
        const opponent = interaction.options.getUser('adversaire');
        const wager = interaction.options.getInteger('mise') || 0;
        const challenger = interaction.user;

        if (opponent.id === challenger.id || opponent.bot) {
            return interaction.reply({ content: '❌ Tu ne peux pas jouer contre toi-même ou un bot !', flags: [64] });
        }

        if (wager > 0) {
            const bal1 = await Blackjack.getBalance(challenger.id);
            const bal2 = await Blackjack.getBalance(opponent.id);

            if (bal1 < wager) return interaction.reply({ content: `❌ Tu n'as pas assez de jetons !`, flags: [64] });
            if (bal2 < wager) return interaction.reply({ content: `❌ ${opponent.username} n'a pas assez de jetons !`, flags: [64] });
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('⚔️ DÉFI MORPION')
            .setDescription(`${challenger} défie ${opponent} !` + (wager > 0 ? `\n\n💰 **ENJEU : ${wager} 🪙**` : '\n\n🎮 *Partie Amicale*'));

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ttt_accept').setLabel('ACCEPTER').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ttt_refuse').setLabel('REFUSER').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ content: `${opponent}`, embeds: [confirmEmbed], components: [confirmRow] });

        try {
            const confirmation = await msg.awaitMessageComponent({
                filter: i => i.user.id === opponent.id,
                time: 30000
            });

            if (confirmation.customId === 'ttt_refuse') {
                return confirmation.update({ content: '❌ Défi refusé.', embeds: [], components: [] });
            }

            if (wager > 0) {
                await Blackjack.updateBalance(challenger.id, -wager);
                await Blackjack.updateBalance(opponent.id, -wager);
            }

            const game = new TicTacToe(challenger, opponent, wager);

            const getBoardComponents = () => {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const index = i * 3 + j;
                        const cell = game.board[index];
                        let label = ' ';
                        let style = ButtonStyle.Secondary;
                        let disabled = false;

                        if (cell === challenger.id) { label = '❌'; style = ButtonStyle.Primary; disabled = true; }
                        else if (cell === opponent.id) { label = '⭕'; style = ButtonStyle.Danger; disabled = true; }
                        else if (game.winner || game.isDraw) { disabled = true; }

                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ttt_cell_${index}`)
                                .setLabel(label)
                                .setStyle(style)
                                .setDisabled(disabled)
                        );
                    }
                    rows.push(row);
                }
                return rows;
            };

            const getEmbed = () => new EmbedBuilder()
                .setTitle(wager > 0 ? `❌ VS ⭕ (Enjeu: ${wager * 2} 🪙)` : '❌ VS ⭕ (Amical)')
                .setDescription(`C'est au tour de : **${game.turn === challenger.id ? challenger.username : opponent.username}**`)
                .setColor(game.turn === challenger.id ? '#3498db' : '#e74c3c');

            await confirmation.update({ embeds: [getEmbed()], components: getBoardComponents() });

            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (![challenger.id, opponent.id].includes(i.user.id)) return i.reply({ content: "Pas touche !", flags: [64] });

                const index = parseInt(i.customId.split('_')[2]);
                const move = game.playMove(i.user.id, index);

                if (!move.success) return i.reply({ content: `❌ ${move.error}`, flags: [64] });

                if (game.winner || game.isDraw) {
                    collector.stop();
                    const finalEmbed = getEmbed();

                    if (game.winner) {
                        const winnerUser = game.winner === challenger.id ? challenger : opponent;
                        finalEmbed.setTitle(`🏆 VICTOIRE DE ${winnerUser.username.toUpperCase()} !`)
                            .setDescription(`**${winnerUser}** a remporté la partie !`)
                            .setColor('#2ecc71');

                        if (wager > 0) {
                            const totalPot = wager * 2;
                            const tax = Math.floor(totalPot * 0.05);
                            const winAmount = totalPot - tax;
                            await Blackjack.updateBalance(game.winner, winAmount);
                            finalEmbed.addFields({ name: 'Gain', value: `💰 **+${winAmount} 🪙**` });
                        }
                    } else {
                        finalEmbed.setTitle('🤝 MATCH NUL !').setDescription("Personne ne gagne.").setColor('#95a5a6');
                        if (wager > 0) {
                            await Blackjack.updateBalance(challenger.id, wager);
                            await Blackjack.updateBalance(opponent.id, wager);
                        }
                    }
                    await i.update({ embeds: [finalEmbed], components: getBoardComponents() });
                } else {
                    await i.update({ embeds: [getEmbed()], components: getBoardComponents() });
                }
            });

        } catch (e) {
            await interaction.editReply({ content: '⏱️ Temps écoulé.', components: [] });
        }
    },
};
