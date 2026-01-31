class Role {
    constructor(id, name, emoji, description, team, imagePath = null) {
        this.id = id;
        this._name = name;
        this.emoji = emoji;
        this.description = description;
        this.team = team; // 'VILLAGE', 'WEREWOLF', 'SOLO'

        // Auto-assign image path following the convention role_[id].png
        this.imagePath = `role_${id}.png`;
    }

    get name() {
        return this._name;
    }

    async onNight(game, player, unixTimestamp, thread) {
        // Logique par défaut pour la nuit (rien)
        return null;
    }

    async onAction(game, player, target, interaction) {
        // Logique quand le joueur utilise son pouvoir sur une cible
        return null;
    }
}

module.exports = Role;
