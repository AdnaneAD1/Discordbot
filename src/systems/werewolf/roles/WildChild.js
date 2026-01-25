const Role = require('../Role');

class WildChild extends Role {
    constructor() {
        super('wild_child', 'Enfant Sauvage', '🏹', 'Au début, vous choisissez un modèle. Si votre modèle meurt, vous devenez un Loup-Garou.', 'VILLAGE');
        this.modelId = null;
    }

    async onNight(game, player, unixTimestamp) {
        if (game.turn === 1 && !this.modelId) {
            const alivePlayers = Array.from(game.players.values()).filter(p => p.id !== player.id);

            const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('🏹 Apprentissage de l\'Enfant Sauvage')
                .setDescription(`Choisissez un modèle à suivre. Si cette personne meurt, vous rejoindrez les loups.\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
                .setColor('#2ecc71');

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_wild_child_action')
                .setPlaceholder('Sélectionner un modèle')
                .addOptions(alivePlayers.map(p => ({
                    label: p.username,
                    value: p.id
                })));

            const row = new ActionRowBuilder().addComponents(select);

            try {
                const user = await game.client.users.fetch(player.id);
                await user.send({ embeds: [embed], components: [row] });
            } catch (e) {
                console.error(`Failed to send Wild Child action to ${player.id}`, e);
            }
        }
    }
}

module.exports = WildChild;
