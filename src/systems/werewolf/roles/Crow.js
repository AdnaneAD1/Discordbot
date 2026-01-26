const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Crow extends Role {
    constructor() {
        super('crow', 'Corbeau', '🐦', 'Chaque nuit, vous pouvez désigner un joueur. Il recevra deux votes d\'office contre lui au prochain conseil.', 'VILLAGE');
    }

    async onNight(game, player, unixTimestamp, thread) {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== player.id);

        const embed = new EmbedBuilder()
            .setTitle('🐦 Malédiction du Corbeau')
            .setDescription(`Désignez quelqu'un à qui porter malheur pour le prochain vote...\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#2c3e50');

        const select = new StringSelectMenuBuilder()
            .setCustomId('lg_crow_action')
            .setPlaceholder('Sélectionner un joueur')
            .addOptions(alivePlayers.map(p => ({
                label: p.username,
                value: p.id
            })));

        const row = new ActionRowBuilder().addComponents(select);

        try {
            return await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Crow action to ${player.id}`, e);
        }
    }
}

module.exports = Crow;
