const Role = require('../Role');

class Heir extends Role {
    constructor() {
        super('heir', 'Héritier', '📜', 'Vous choisissez un testament. Si ce joueur meurt, vous récupérez son rôle.', 'VILLAGE');
        this.targetId = null;
    }

    async onNight(game, player, unixTimestamp, thread) {
        if (game.turn === 1 && !this.targetId) {
            const alivePlayers = Array.from(game.players.values()).filter(p => p.id !== player.id);

            const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('📜 Testament de l\'Héritier')
                .setDescription(`Choisissez un joueur dont vous souhaitez hériter du rôle à sa mort.\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
                .setColor('#f39c12');

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_heir_action')
                .setPlaceholder('Sélectionner un joueur')
                .addOptions(alivePlayers.map(p => ({
                    label: p.username,
                    value: p.id
                })));

            const row = new ActionRowBuilder().addComponents(select);

            try {
                return await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
            } catch (e) {
                console.error(`Failed to send Heir action to ${player.id}`, e);
            }
        }
    }
}

module.exports = Heir;
