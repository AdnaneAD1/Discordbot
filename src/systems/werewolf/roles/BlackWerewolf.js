const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class BlackWerewolf extends Role {
    constructor() {
        super('black_werewolf', 'Loup Noir', '🖤', 'Une fois par partie, vous pouvez infecter la victime des loups pour la transformer en Loup-Garou.', 'WEREWOLF');
        this.hasInfectionPower = true;
    }

    async onNight(game, player) {
        // Le loup noir voit la victime actuelle et peut décider de l'infecter
        // On affichera le menu seulement si les loups ont déjà voté
    }
}

module.exports = BlackWerewolf;
