const Role = require('../Role');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class Witch extends Role {
    constructor() {
        super('witch', 'Sorcière', '🧪', 'Vous avez deux potions : une pour sauver la victime des loups, une pour tuer quelqu\'un.', 'VILLAGE', 'witch.png');
        this.hasResurrectionPotion = true;
        this.hasDeathPotion = true;
    }

    async onNight(game, player, unixTimestamp) {
        // La sorcière agit après les loups en général.
        // Cette méthode sera appelée par Game.js avec les infos de la victime.
        const victim = game.nightActions.wolfTargetId ? game.players.get(game.nightActions.wolfTargetId) : null;

        const embed = new EmbedBuilder()
            .setTitle('🧪 Pouvoir de la Sorcière')
            .setDescription(`${victim ? `Les loups ont choisi de tuer <@${victim.id}>.` : "Les loups n'ont tué personne cette nuit."}\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#2ecc71');

        const row = new ActionRowBuilder();

        if (this.hasResurrectionPotion && victim) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('lg_witch_save')
                    .setLabel('Utiliser la potion de vie')
                    .setStyle(ButtonStyle.Success)
            );
        }

        if (this.hasDeathPotion) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('lg_witch_kill')
                    .setLabel('Utiliser la potion de mort')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        row.addComponents(
            new ButtonBuilder()
                .setCustomId('lg_witch_skip')
                .setLabel('Ne rien faire')
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            const user = await game.client.users.fetch(player.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Witch action to ${player.id}`, e);
        }
    }
}

module.exports = Witch;
