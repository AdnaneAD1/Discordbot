const Role = require('../Role');
const { EmbedBuilder } = require('discord.js');

class Mentalist extends Role {
    constructor() {
        super('mentalist', 'Mentaliste', '🧠', 'Chaque nuit, vous analysez l\'atmosphère. Vous découvrez si le vote des loups était "divisé" ou "unanime".', 'VILLAGE');
    }

    async onNight(game, player, unixTimestamp, thread) {
        // En réalité, le mentaliste reçoit l'info au matin ou par MP après le vote des loups.
        if (game.turn > 0 && game.isWolfUnanimous !== undefined) {
            const status = game.isWolfUnanimous ? '**UNANIME** ✅' : '**DIVISÉ** ❌';
            return await thread.send(`🧠 Ton analyse mentale révèle que le vote des loups cette nuit était : ${status}`);
        }
    }
}

module.exports = Mentalist;
