class Player {
    constructor(user) {
        this.id = user.id;
        this.username = user.globalName || user.username;
        this.avatar = user.displayAvatarURL();
        this.role = null;
        this.isAlive = true;
        this.isProtected = false;
        this.isInfected = false;
        this.lover = null; // Si Cupidon passe par là
        this.votes = 0; // Nombre de votes contre lui ce tour
        this.voteTarget = null; // Contre qui il a voté
        this.powerless = false; // Perte de pouvoirs suite au sacrilège
    }

    assignRole(roleInstance) {
        this.role = roleInstance;
    }

    kill() {
        this.isAlive = false;
    }
}

module.exports = Player;
