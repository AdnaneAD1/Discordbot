const Role = require('../Role');

class Gravedigger extends Role {
    constructor() {
        super('gravedigger', 'Fossoyeur', '⚰️', 'Chaque nuit, vous découvrez si le mort de la veille était un Villageois ou un Loup.', 'VILLAGE');
    }

    async onNight(game, player, unixTimestamp, thread) {
        if (!game.lastDead) return;

        try {
            const teamMsg = game.lastDead.role.team === 'WEREWOLF' ? 'un **Loup-Garou** 🐺' : 'un **Villageois** 🛖';
            return await thread.send(`⚰️ Tes fouilles révèlent que le dernier mort (<@${game.lastDead.id}>) était ${teamMsg}.`);
        } catch (e) {
            console.error(`Failed to send Gravedigger info to ${player.id}`, e);
        }
    }
}

module.exports = Gravedigger;
