const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class Pyromaniac extends Role {
    constructor() {
        super('pyromaniac', 'Pyromane', '🔥', 'Chaque nuit, vous pouvez gazer jusqu\'à deux joueurs. Vous pouvez aussi choisir de déclencher l\'incendie pour tuer tous les joueurs gazés.', 'PYROMANIAC');
        this.gassedIds = new Set();
    }

    async onNight(game, player, unixTimestamp) {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== player.id);

        const embed = new EmbedBuilder()
            .setTitle('🔥 Obsession du Pyromane')
            .setDescription(`Joueurs actuellement gazés : ${this.gassedIds.size}\nQue voulez-vous faire ce soir ?\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#e67e22');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('lg_pyro_gas_menu')
                .setLabel('Gazer des gens')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🧴'),
            new ButtonBuilder()
                .setCustomId('lg_pyro_burn')
                .setLabel('DÉCLENCHER L\'INCENDIE')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔥')
        );

        try {
            const user = await game.client.users.fetch(player.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Pyromaniac action to ${player.id}`, e);
        }
    }
}

module.exports = Pyromaniac;
