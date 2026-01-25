const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class BlackWerewolf extends Role {
    constructor() {
        super('black_werewolf', 'Loup Noir', '🖤', 'Une fois par partie, vous pouvez infecter la victime des loups pour la transformer en Loup-Garou.', 'WEREWOLF');
        this.hasInfectionPower = true;
    }

    async onNight(game, player, unixTimestamp, thread) {
        // Le loup noir voit la victime actuelle et peut décider de l'infecter
        // Cette logique est gérée dans handleNightResult pour l'instant car elle dépend du vote des loups
        // Mais si on voulait déplacer la logique ici, on utiliserait 'thread'
    }
}

module.exports = BlackWerewolf;
