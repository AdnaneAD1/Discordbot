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
                .setDescription('Arrêter la partie en cours')),

    async execute(interaction) {
        // Accès au manager via client (sera attaché dans index.js principal)
        const manager = interaction.client.werewolf;
        const subcommand = interaction.options.getSubcommand();

        // Vérification du salon (à implémenter avec la config)
        // const config = await getConfig(interaction.guildId);
        // if (interaction.channelId !== config.werewolf_channel) ...

        if (subcommand === 'create') {
            if (manager.getGame(interaction.channel.id)) {
                return interaction.reply({ content: '❌ Une partie est déjà en cours dans ce salon !', ephemeral: true });
            }
            const game = manager.createGame(interaction.channel, interaction.user);
            await game.startLobby();
            return interaction.reply({ content: '🏡 Lobby créé !', ephemeral: true });
        }

        const game = manager.getGame(interaction.channel.id);
        if (!game) {
            return interaction.reply({ content: '❌ Aucune partie en cours ici.', ephemeral: true });
        }

        if (subcommand === 'start') {
            if (interaction.user.id !== game.host.id) {
                return interaction.reply({ content: '❌ Seul l\'hôte peut lancer la partie.', ephemeral: true });
            }
            await game.start();
            return interaction.reply({ content: '🚀 Lancement...', ephemeral: true });
        }

        if (subcommand === 'stop') {
            // Admin ou Host
            if (interaction.user.id !== game.host.id && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
            }
            game.stop();
            return interaction.reply({ content: '🛑 Partie arrêtée.', ephemeral: true });
        }
    }
};
