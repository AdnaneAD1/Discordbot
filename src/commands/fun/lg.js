const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isGuildPremium } = require('../../services/subscriptions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lg')
        .setDescription('Commandes du jeu Loup-Garou (Premium)')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Créer un lobby de partie (Premium Only)'))
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Forcer le démarrage de la partie'))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Arrêter la partie en cours'))
        .addSubcommand(sub =>
            sub.setName('rules')
                .setDescription('Afficher le guide complet du jeu'))
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('Afficher le classement des meilleurs joueurs (Premium Only)')),

    async execute(interaction) {
        const manager = interaction.client.werewolf;
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- Vérification Premium Générale (sauf pour rules) ---
        if (subcommand !== 'rules') {
            const premiumStatus = await isGuildPremium(guildId);
            if (!premiumStatus.isPremium) {
                return interaction.reply({
                    content: '⭐ **Le Loup-Garou est une fonctionnalité Premium.**\nActivez le premium sur ce serveur avec `/premium activate` pour jouer !',
                    flags: [64]
                });
            }
        }

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

        if (subcommand === 'leaderboard') {
            const { getLeaderboard, GAME_TYPES } = require('../../systems/gameStats');
            const leaderboard = await getLeaderboard(guildId, GAME_TYPES.WEREWOLF, 'wins', 10);

            if (leaderboard.length === 0) {
                return interaction.reply({
                    content: '📊 **Aucune donnée pour le moment.** Jouez quelques parties pour apparaître ici !',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 Classement Loup-Garou - Top 10')
                .setColor('#f1c40f')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png');

            let description = "";
            leaderboard.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
                const winRate = user.gamesPlayed > 0 ? ((user.wins / user.gamesPlayed) * 100).toFixed(1) : 0;
                description += `${medal} **#${index + 1}** <@${user.oderId}> : **${user.wins}** Victoires (${winRate}%)\n`;
            });

            embed.setDescription(description);
            return interaction.reply({ embeds: [embed] });
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
            if (interaction.user.id !== game.host.id && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Permission refusée.', flags: [64] });
            }
            game.stop();
            return interaction.reply({ content: '🛑 Partie arrêtée.', flags: [64] });
        }
    }
};
