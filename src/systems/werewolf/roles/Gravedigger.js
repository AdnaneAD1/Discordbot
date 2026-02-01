const Role = require('../Role');

class Gravedigger extends Role {
    constructor() {
        super('gravedigger', 'Fossoyeur', '⚰️', 'Chaque nuit, vous découvrez si le mort de la veille était un Villageois ou un Loup.', 'VILLAGE');
    }

    async onNight(game, player, unixTimestamp, thread) {
        if (!game.recentDeadIds || game.recentDeadIds.length === 0) {
            return await thread.send(`⚰️ Tes fouilles sont infructueuses. Personne n'est mort récemment.`);
        }

        try {
            let report = "⚰️ **Rapport du Fossoyeur**\n";
            for (const deadId of game.recentDeadIds) {
                const deadPlayer = game.players.get(deadId);
                if (deadPlayer) {
                    const isWolf = deadPlayer.role.team === 'WEREWOLF' || deadPlayer.role.id === 'white_werewolf';
                    const teamMsg = isWolf ? 'un **Loup-Garou** 🐺' : 'un **Villageois** 🛖';
                    report += `- <@${deadPlayer.id}> était ${teamMsg}.\n`;
                }
            }
            return await thread.send(report);
        } catch (e) {
            console.error(`Failed to send Gravedigger info to ${player.id}`, e);
        }
    }
}

module.exports = Gravedigger;
