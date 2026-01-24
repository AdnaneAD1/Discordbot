const Role = require('../Role');
const { EmbedBuilder } = require('discord.js');

class Mentalist extends Role {
    constructor() {
        super('mentalist', 'Mentaliste', '🧠', 'Chaque nuit, vous analysez l\'atmosphère. Vous découvrez si le vote des loups était "divisé" ou "unanime".', 'VILLAGE');
    }

    async onNight(game, player) {
        // En réalité, le mentaliste reçoit l'info au matin ou par MP après le vote des loups.
        // Ici, on va juste préparer le terrain. L'info sera envoyée dans handleNightResult.
    }
}

module.exports = Mentalist;
