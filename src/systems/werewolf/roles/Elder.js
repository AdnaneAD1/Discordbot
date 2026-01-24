const Role = require('../Role');

class Elder extends Role {
    constructor() {
        super('elder', 'Ancien', '👴', 'Vous survivez à une seule attaque des Loups-Garous. Si vous êtes tué par le village, tous les villageois perdent leurs pouvoirs.', 'VILLAGE');
        this.extraLife = true;
    }
}

module.exports = Elder;
