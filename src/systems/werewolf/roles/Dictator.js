const Role = require('../Role');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class Dictator extends Role {
    constructor() {
        super('dictator', 'Dictateur', '👑', 'Une fois par partie, vous pouvez prendre le pouvoir pendant la journée. Vous choisirez seul qui éliminer.', 'VILLAGE');
        this.hasPower = true;
    }

    async onDay(game, player) {
        if (!this.hasPower) return;

        const embed = new EmbedBuilder()
            .setTitle('👑 Pouvoir du Dictateur')
            .setDescription('Voulez-vous prendre le pouvoir aujourd\'hui ? Si oui, vous serez le seul à voter.')
            .setColor('#f1c40f');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('lg_dictator_takeover')
                .setLabel('Prendre le pouvoir')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👑'),
            new ButtonBuilder()
                .setCustomId('lg_dictator_skip')
                .setLabel('Ne rien faire')
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            const user = await game.client.users.fetch(player.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Dictator power to ${player.id}`, e);
        }
    }
}

module.exports = Dictator;
