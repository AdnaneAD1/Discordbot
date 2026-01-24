const Role = require('../Role');

class Sorcerer extends Role {
    constructor() {
        super('sorcerer', 'Sorcier', '🧙‍♂️', 'Vous gagnez avec les Loups-Garous. Vous connaissez leur identité, mais ils ne vous connaissent pas d\'office.', 'WEREWOLF');
    }

    async onNight(game, player) {
        if (game.turn === 1) {
            const wolves = Array.from(game.players.values()).filter(p => (p.role.team === 'WEREWOLF' || p.role.id === 'white_werewolf') && p.id !== player.id);

            try {
                const user = await game.client.users.fetch(player.id);
                const wolfList = wolves.map(w => `**${w.username}**`).join(', ');
                await user.send(`🧙‍♂️ Tes visions te révèlent l'identité des loups : ${wolfList || 'Tu es le seul !'}`);
            } catch (e) {
                console.error(`Failed to send Sorcerer info to ${player.id}`, e);
            }
        }
    }
}

module.exports = Sorcerer;
