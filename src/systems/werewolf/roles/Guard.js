const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Guard extends Role {
    constructor() {
        super('guard', 'Garde', '🛡️', 'Chaque nuit, vous protégez un joueur de l\'attaque des loups. Vous ne pouvez pas protéger deux fois de suite la même personne.', 'VILLAGE');
        this.lastProtectedId = null;
    }

    async onNight(game, player, unixTimestamp, thread) {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== this.lastProtectedId);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Protection du Garde')
            .setDescription(`Qui voulez-vous protéger cette nuit ?\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#3498db');

        const select = new StringSelectMenuBuilder()
            .setCustomId('lg_guard_action')
            .setPlaceholder('Sélectionner un joueur')
            .addOptions(alivePlayers.map(p => ({
                label: p.username,
                value: p.id
            })));

        const row = new ActionRowBuilder().addComponents(select);

        try {
            await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Guard action to ${player.id}`, e);
        }
    }
}

module.exports = Guard;
