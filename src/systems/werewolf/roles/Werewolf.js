const Role = require('../Role');

class Werewolf extends Role {
    constructor() {
        super('werewolf', 'Loup-Garou', '🐺', 'Vous devez tuer tous les villageois. Chaque nuit, vous vous réunissez pour choisir une victime.', 'WEREWOLF', 'werewolf.png');
    }
}

module.exports = Werewolf;
