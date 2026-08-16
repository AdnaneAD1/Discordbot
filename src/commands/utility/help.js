const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche le guide complet des commandes et du bot 📚'),

    async execute(interaction) {
        const categories = {
            'fun': {
                emoji: '🎲',
                label: 'Fun & Mini-Jeux',
                description: 'Arcade, Casino et divertissement',
                commands: [
                    { name: '/blackjack', desc: 'Joue au Blackjack (Gain x2).', example: '/blackjack mise:100' },
                    { name: '/roulette', desc: 'Parie sur une couleur ou un nombre.', example: '/roulette mise:50 choix:rouge' },
                    { name: '/puissance4', desc: 'Duel de Puissance 4 contre un ami.', example: '/puissance4 adversaire:@Ami mise:200' },
                    { name: '/morpion', desc: 'Duel de Tic-Tac-Toe.', example: '/morpion adversaire:@Ami' },
                    { name: '/casinotop', desc: 'Voir le classement des plus riches.', example: '/casinotop' },
                    { name: '/daily', desc: 'Réclame tes jetons quotidiens.', example: '/daily' },
                    { name: '/chips', desc: 'Affiche ton solde de jetons.', example: '/chips' },
                    { name: '/rank', desc: 'Affiche ton niveau et XP.', example: '/rank user:@Ami' },
                    { name: '/top', desc: 'Affiche le classement XP du serveur.', example: '/top' },
                    { name: '/defi', desc: 'Lance un défi aléatoire pour gagner de l\'XP.', example: '/defi' },
                    { name: '/redeem', desc: 'Échange tes jetons contre des bonus.', example: '/redeem code:SURPRISE' }
                ]
            },
            'werewolf': {
                emoji: '🐺',
                label: 'Loup-Garou RPG',
                description: 'Le célèbre jeu de rôle entièrement automatisé',
                commands: [
                    { name: '/lg create', desc: 'Crée une partie (Premium).', example: '/lg create' },
                    { name: '/lg join', desc: 'Rejoint la partie actuelle.', example: '/lg join' },
                    { name: '/lg start', desc: 'Lance la partie (Host).', example: '/lg start' },
                    { name: '/lg quit', desc: 'Quitte la partie en cours.', example: '/lg quit' },
                    { name: '/lg rules', desc: 'Guide des rôles et règles.', example: '/lg rules' }
                ]
            },
            'music': {
                emoji: '🎵',
                label: 'Musique',
                description: 'Système musical haute qualité',
                commands: [
                    { name: '/play', desc: 'Joue une musique ou playlist.', example: '/play query:Lofi Girl' },
                    { name: '/pause', desc: 'Met en pause ou reprend.', example: '/pause' },
                    { name: '/skip', desc: 'Passe au titre suivant.', example: '/skip' },
                    { name: '/stop', desc: 'Arrête la musique et vide la file.', example: '/stop' },
                    { name: '/loop', desc: 'Active/Désactive la boucle.', example: '/loop mode:track' },
                    { name: '/queue', desc: 'Affiche la file d\'attente.', example: '/queue' },
                    { name: '/playlist create', desc: 'Crée une playlist perso.', example: '/playlist create nom:Chill' },
                    { name: '/playlist play', desc: 'Joue tes playlists sauvegardées.', example: '/playlist play nom:Chill' }
                ]
            },
            'image': {
                emoji: '🎨',
                label: 'Image & Création',
                description: 'Génération d\'images IA',
                commands: [
                    { name: '/imagine', desc: 'Génère une image via Prompt.', example: '/imagine prompt:Chat cyberpunk' },
                    { name: '/imagine [image]', desc: 'Modifie une image (Img2Img).', example: '/imagine prompt:En dessin animé (avec image attachée)' }
                ]
            },
            'users': {
                emoji: '👥',
                label: 'Profil & Social',
                description: 'Commandes utilisateur et profile',
                commands: [
                    { name: '/profile', desc: 'Affiche ton profil complet.', example: '/profile' },
                    { name: '/add-social', desc: 'Ajoute tes réseaux sur ton profil.', example: '/add-social plateforme:Instagram lien:...' }
                ]
            },
            'moderation': {
                emoji: '🛡️',
                label: 'Modération & Admin',
                description: 'Outils de gestion (Staff uniquement)',
                commands: [
                    { name: '/ban', desc: 'Bannir un utilisateur.', example: '/ban target:@Troll reason:Spam' },
                    { name: '/kick', desc: 'Expulser un utilisateur.', example: '/kick target:@User' },
                    { name: '/warn', desc: 'Avertir un utilisateur.', example: '/warn target:@User reason:Insultes' },
                    { name: '/clean', desc: 'Supprime des messages (Bulk Delete).', example: '/clean amount:50' },
                    { name: '/giveaway', desc: 'Lance un concours.', example: '/giveaway prize:Nitro time:24h winners:1' },
                    { name: '/setup-tickets', desc: 'Configure le système de tickets.', example: '/setup-tickets channel:#support' },
                    { name: '/setup-welcome', desc: 'Configure les messages de bienvenue.', example: '/setup-welcome channel:#bienvenue' },
                    { name: '/welcome-setup', desc: 'Configure l\'image de bienvenue.', example: '/welcome-setup' }
                ]
            }
        };

        const embed = new EmbedBuilder()
            .setTitle('📚 Centre d\'Aide Open Discord Bot')
            .setDescription('Bienvenue ! Sélectionnez une catégorie ci-dessous pour voir toutes les commandes.\nChaque commande est détaillée avec un exemple d\'utilisation.')
            .setColor('#2b2d31')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields({
                name: '🪙 100% Gratuit & Open Source',
                value: 'Toutes les fonctionnalités premium sont débloquées par défaut pour tout le monde !'
            });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Choisir une catégorie...')
            .addOptions(
                Object.entries(categories).map(([key, data]) => ({
                    label: data.label,
                    description: data.description,
                    value: key,
                    emoji: data.emoji
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: [64] // Ephemeral
        });

        // Collecteur pour le menu déroulant
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            const categoryKey = i.values[0];
            const category = categories[categoryKey];

            const categoryEmbed = new EmbedBuilder()
                .setTitle(`${category.emoji} ${category.label}`)
                .setDescription(category.description)
                .setColor('#f39c12');

            // Formatter les commandes
            const fields = category.commands.map(cmd => ({
                name: `\`${cmd.name}\``,
                value: `${cmd.desc}\n💡 *Ex: \`${cmd.example}\`*`,
                inline: false
            }));

            categoryEmbed.addFields(fields);

            categoryEmbed.setFooter({ text: 'Astuce : Les paramètres obligatoires sont souvent auto-suggérés par Discord.' });

            await i.update({ embeds: [categoryEmbed], components: [row] });
        });
    }
};
