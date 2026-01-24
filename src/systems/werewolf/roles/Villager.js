const Role = require('../Role');

class Villager extends Role {
    constructor() {
        super('villager', 'Villageois', '🛖', 'Vous n\'avez aucun pouvoir particulier. Votre but est d\'éliminer tous les Loups-Garous.', 'VILLAGE', 'villager.png');
    }
}

module.exports = Villager;
