const Role = require('../Role');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class Witch extends Role {
    constructor() {
        super('witch', 'Sorcière', '🧪', 'Vous avez deux potions : une pour sauver la victime des loups, une pour tuer quelqu\'un.', 'VILLAGE', 'witch.png');
        this.hasLifePotion = true;
        this.hasDeathPotion = true;
    }

    async onNight(game, player, unixTimestamp, thread) {
        const victimOfWolves = game.nightActions.wolfTargetId ? game.players.get(game.nightActions.wolfTargetId) : null;

        const embed = new EmbedBuilder()
            .setTitle('🧪 Pouvoir de la Sorcière')
            .setDescription(`${victimOfWolves ? `Les loups ont choisi de tuer <@${victimOfWolves.id}>.` : "Les loups n'ont tué personne cette nuit."}\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
            .setColor('#2ecc71');

        const row = new ActionRowBuilder();

        if (this.hasLifePotion && victimOfWolves) {
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
                .setLabel('Ne rien faire / Terminer')
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            return await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Witch action to ${player.id}`, e);
        }
    }
}

module.exports = Witch;
