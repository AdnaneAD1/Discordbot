const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Seer extends Role {
    constructor() {
        super('seer', 'Voyante', '🔮', 'Chaque nuit, vous pouvez découvrir le rôle d\'un joueur.', 'VILLAGE', 'seer.png');
    }

    async onNight(game, player, unixTimestamp, thread) {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== player.id);

        const embed = new EmbedBuilder()
            .setTitle('🔮 Pouvoir de la Voyante')
            .setDescription(`Choisissez un joueur pour découvrir son secret...\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#9b59b6');

        const select = new StringSelectMenuBuilder()
            .setCustomId('lg_seer_action')
            .setPlaceholder('Sélectionner un joueur')
            .addOptions(alivePlayers.map(p => ({
                label: p.username,
                value: p.id
            })));

        const row = new ActionRowBuilder().addComponents(select);

        try {
            await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Seer action to ${player.id}`, e);
        }
    }
}

module.exports = Seer;
