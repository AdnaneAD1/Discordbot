const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } = require('discord.js');
const Connect4 = require('../../systems/connect4');
const { Blackjack } = require('../../systems/casino'); // Pour gérer les mises

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connect4')
        .setDescription('Duel de Puissance 4 !')
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

        // Vérification des soldes si pari
        if (wager > 0) {
            const bal1 = await Blackjack.getBalance(challenger.id);
            const bal2 = await Blackjack.getBalance(opponent.id);

            if (bal1 < wager) return interaction.reply({ content: `❌ Tu n'as pas assez de jetons pour ce pari !`, flags: [64] });
            if (bal2 < wager) return interaction.reply({ content: `❌ ${opponent.username} n'a pas assez de jetons !`, flags: [64] });
        }

        // Demande d'acceptation
        const confirmEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('⚔️ DÉFI PUISSANCE 4')
            .setDescription(`${challenger} défie ${opponent} !` + (wager > 0 ? `\n\n💰 **ENJEU : ${wager} 🪙**` : '\n\n🎮 *Partie Amicale*'));

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('c4_accept').setLabel('ACCEPTER').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('c4_refuse').setLabel('REFUSER').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ content: `${opponent}`, embeds: [confirmEmbed], components: [confirmRow] });

        try {
            const confirmation = await msg.awaitMessageComponent({
                filter: i => i.user.id === opponent.id,
                time: 30000
            });

            if (confirmation.customId === 'c4_refuse') {
                return confirmation.update({ content: '❌ Défi refusé.', embeds: [], components: [] });
            }

            // Démarrage du jeu
            if (wager > 0) {
                // Verrouillage des mises (on retire aux deux)
                await Blackjack.updateBalance(challenger.id, -wager);
                await Blackjack.updateBalance(opponent.id, -wager);
            }

            const game = new Connect4(challenger, opponent, wager);

            const getGameEmbed = () => new EmbedBuilder()
                .setTitle(wager > 0 ? `🔴 VS 🟡 (Enjeu: ${wager * 2} 🪙)` : '🔴 VS 🟡 (Amical)')
                .setDescription(game.getBoardString())
                .setFooter({ text: `Tour de : ${game.turn === challenger.id ? challenger.username : opponent.username}` })
                .setColor(game.turn === challenger.id ? '#e74c3c' : '#f1c40f');

            // Création des boutons (1-7)
            const getRows = () => {
                const row1 = new ActionRowBuilder();
                const row2 = new ActionRowBuilder();
                for (let i = 0; i < 7; i++) {
                    const btn = new ButtonBuilder()
                        .setCustomId(`c4_col_${i}`)
                        .setLabel(`${i + 1}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(game.board[0][i] !== null || game.winner !== null); // Désactivé si colonne pleine ou win

                    if (i < 4) row1.addComponents(btn);
                    else row2.addComponents(btn);
                }
                return [row1, row2];
            };

            await confirmation.update({ embeds: [getGameEmbed()], components: getRows() });

            const collector = msg.createMessageComponentCollector({
                time: 300000 // 5 minutes max
            });

            collector.on('collect', async i => {
                if (![challenger.id, opponent.id].includes(i.user.id)) {
                    return i.reply({ content: "Ce n'est pas ta partie !", flags: [64] });
                }

                const colIndex = parseInt(i.customId.split('_')[2]);
                const move = game.playMove(i.user.id, colIndex);

                if (!move.success) {
                    return i.reply({ content: `❌ ${move.error}`, flags: [64] });
                }

                if (game.winner || game.isDraw) {
                    collector.stop();
                    let finalEmbed = getGameEmbed();

                    if (game.winner) {
                        const winnerUser = game.winner === challenger.id ? challenger : opponent;
                        finalEmbed.setTitle(`🏆 VICTOIRE DE ${winnerUser.username.toUpperCase()} !`)
                            .setColor('#2ecc71')
                            .setFooter({ text: 'Partie terminée.' });

                        if (wager > 0) {
                            const totalPot = wager * 2;
                            const tax = Math.floor(totalPot * 0.05);
                            const winAmount = totalPot - tax;
                            await Blackjack.updateBalance(game.winner, winAmount);
                            finalEmbed.setDescription(game.getBoardString() + `\n\n💰 **+${winAmount} 🪙** pour le vainqueur !`);
                        }
                    } else {
                        finalEmbed.setTitle('🤝 MATCH NUL !').setColor('#95a5a6');
                        if (wager > 0) {
                            // Remboursement
                            await Blackjack.updateBalance(challenger.id, wager);
                            await Blackjack.updateBalance(opponent.id, wager);
                        }
                    }

                    await i.update({ embeds: [finalEmbed], components: [] });
                } else {
                    await i.update({ embeds: [getGameEmbed()], components: getRows() });
                }
            });

        } catch (e) {
            await interaction.editReply({ content: '⏱️ Temps écoulé pour accepter le défi.', components: [] });
        }
    },
};
