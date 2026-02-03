const { SlashCommandBuilder } = require('discord.js');
// werewolfManager is accessed via interaction.client.werewolf

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lg')
        .setDescription('Commandes du jeu Loup-Garou')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Créer un lobby de partie'))
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Forcer le démarrage de la partie'))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Arrêter la partie en cours'))
        .addSubcommand(sub =>
            sub.setName('rules')
                .setDescription('Afficher le guide complet du jeu')),

    async execute(interaction) {
        const manager = interaction.client.werewolf;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'rules') {
            const GameInfo = require('../../systems/werewolf/GameInfo');
            await GameInfo.sendAll(interaction.channel);
            return interaction.reply({ content: '📖 Guide envoyé !', flags: [64] });
        }

        if (subcommand === 'create') {
            if (manager.getGame(interaction.channel.id)) {
                return interaction.reply({ content: '❌ Une partie est déjà en cours dans ce salon !', flags: [64] });
            }
            const game = manager.createGame(interaction.channel, interaction.user);
            await game.startLobby();
            return interaction.reply({ content: '🏡 Lobby créé !', flags: [64] });
        }

        const game = manager.getGame(interaction.channel.id);
        if (!game) {
            return interaction.reply({ content: '❌ Aucune partie en cours ici.', flags: [64] });
        }

        if (subcommand === 'start') {
            if (interaction.user.id !== game.host.id) {
                return interaction.reply({ content: '❌ Seul l\'hôte peut lancer la partie.', flags: [64] });
            }
            await game.start();
            return interaction.reply({ content: '🚀 Lancement...', flags: [64] });
        }

        if (subcommand === 'stop') {
            // Admin ou Host
            if (interaction.user.id !== game.host.id && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Permission refusée.', flags: [64] });
            }
            game.stop();
            return interaction.reply({ content: '🛑 Partie arrêtée.', flags: [64] });
        }
    }
};
