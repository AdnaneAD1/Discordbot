const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Cupid extends Role {
    constructor() {
        super('cupid', 'Cupidon', '💘', 'Au début de la partie, vous choisissez deux joueurs qui seront liés à jamais. S\'il l\'un meurt, l\'autre aussi.', 'VILLAGE', 'cupid.png');
        this.used = false;
    }

    async onNight(game, player, unixTimestamp, thread) {
        if (game.turn === 1 && !this.used) {
            const alivePlayers = Array.from(game.players.values());

            const embed = new EmbedBuilder()
                .setTitle('💘 Arc de Cupidon')
                .setDescription(`Choisissez DEUX joueurs pour les rendre amoureux...\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
                .setColor('#ffafbd');

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_cupid_action')
                .setPlaceholder('Sélectionner deux joueurs')
                .setMinValues(2)
                .setMaxValues(2)
                .addOptions(alivePlayers.map(p => ({
                    label: p.username,
                    value: p.id
                })));

            const row = new ActionRowBuilder().addComponents(select);

            try {
                await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
            } catch (e) {
                console.error(`Failed to send Cupid action to ${player.id}`, e);
            }
        }
    }
}

module.exports = Cupid;
