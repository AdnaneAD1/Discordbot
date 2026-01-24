class Role {
    constructor(id, name, emoji, description, team, imagePath = null) {
        this.id = id;
        this.name = name;
        this.emoji = emoji;
        this.description = description;
        this.team = team; // 'VILLAGE', 'WEREWOLF', 'SOLO'
        this.imagePath = imagePath;
    }

    async onNight(game, player) {
        // Logique par défaut pour la nuit (rien)
        return null;
    }

    async onAction(game, player, target, interaction) {
        // Logique quand le joueur utilise son pouvoir sur une cible
        return null;
    }
}

module.exports = Role;
