const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Affiche les règles détaillées des jeux 📜')
        .addStringOption(option =>
            option.setName('jeu')
                .setDescription('Le jeu dont tu veux voir les règles')
                .setRequired(true)
                .addChoices(
                    { name: '🃏 Blackjack', value: 'blackjack' },
                    { name: '🔴 Roulette', value: 'roulette' },
                    { name: '🐺 Loup-Garou', value: 'werewolf' },
                    { name: '🔴 Connect 4 (Puissance 4)', value: 'connect4' },
                    { name: '❌ Tic-Tac-Toe (Morpion)', value: 'tictactoe' }
                )),

    async execute(interaction) {
        const game = interaction.options.getString('jeu');
        let embed = new EmbedBuilder().setColor('#2b2d31');

        switch (game) {
            case 'blackjack':
                embed.setTitle('🃏 Règles du Blackjack (21)')
                    .setColor('#e74c3c')
                    .setDescription(`Le but est de battre le croupier (le Bot) en obtenant un score le plus proche possible de **21**, sans jamais le dépasser.`)
                    .addFields(
                        { name: '🔢 Valeur des Cartes', value: '• **2-9** : Valeur faciale\n• **10, Valet, Dame, Roi** : 10 points\n• **As** : 1 ou 11 points (selon ce qui t\'arrange)' },
                        { name: '🎮 Comment Jouer', value: '1. Lance une partie : `/blackjack mise:100`\n2. Tu reçois 2 cartes.\n3. Bouton **Tirer** : Tu prends une carte (Attention au bust !).\n4. Bouton **Rester** : Tu gardes ton score et c\'est au croupier.\n5. Le croupier doit tirer jusqu\'à 17 minimum.' },
                        { name: '💰 Gains & Taxes', value: '• **Victoire** : Gain x2 (ex: mise 100 -> gagne 200).\n• **Blackjack** : Gain x2.5 (Natural 21).\n• **Égalité** : Remboursement.\n⚠️ *Taxe Casino : 5% sont prélevés sur les gains nets.*' }
                    );
                break;

            case 'roulette':
                embed.setTitle('🔴 Règles de la Roulette')
                    .setColor('#2ecc71')
                    .setDescription('Le jeu de hasard ultime. Parie sur le résultat de la bille.')
                    .addFields(
                        { name: '🎯 Les Paris possibles', value: '• **Couleur** (Rouge/Noir) : Gain **x2** (48.6% de chance)\n• **Nombre** (0-36) : Gain **x35** (2.7% de chance)\n• **Parité** (Pair/Impair) : Gain **x2**\n• **Douzaine** (1-12, 13-24, 25-36) : Gain **x3**' },
                        { name: '🎮 Comment Jouer', value: '• `/roulette mise:100 choix:rouge` (Pour doubler)\n• `/roulette mise:10 choix:7` (Pour tenter le jackpot)' },
                        { name: '💸 Important', value: 'Le **0 (Vert)** fait perdre les mises couleurs/pair/impair. C\'est l\'avantage de la maison.\n⚠️ *Taxe Casino : 5% sur les gains.*' }
                    );
                break;

            case 'werewolf':
                embed.setTitle('🐺 Règles du Loup-Garou RPG')
                    .setColor('#8e44ad')
                    .setDescription('Un jeu de mensonge et de déduction. Le Village doit survivre aux Loups.')
                    .addFields(
                        { name: '🌞 Le Cycle', value: '• **Nuit** : Les Loups choisissent une victime. La Voyante sonde un rôle. La Sorcière utilise ses potions.\n• **Jour** : Tout le village débat. Un vote a lieu pour éliminer un suspect.' },
                        { name: '🎮 Commandes', value: '• `/lg join` : Rejoindre le lobby.\n• `/lg start` : Lancer la partie (Hôte).\n• `/lg quit` : Quitter le jeu.' },
                        { name: '🏆 Conditions de Victoire', value: '• **Village** : Tuer tous les Loups.\n• **Loups** : Tuer tous les Villageois.\n• **Loup Blanc** : Finir SEUL survivant.' }
                    );
                break;

            case 'connect4':
                embed.setTitle('🔴 Règles du Puissance 4 (Duel)')
                    .setColor('#3498db')
                    .setDescription('Affronte un autre joueur en misant des jetons !')
                    .addFields(
                        { name: '🎯 Objectif', value: 'Aligner **4 jetons** de ta couleur (Horizontal, Vertical ou Diagonal) avant l\'autre.' },
                        { name: '🎮 Comment Jouer', value: '1. Lance un défi : `/puissance4 adversaire:@Ami mise:500`\n2. L\'ami accepte via le bouton.\n3. Cliquez sur les boutons 1-7 pour jouer.\n4. Le gagnant remporte TOUT (Mise x2 - 5%).' },
                        { name: '⚠️ Anti-Triche', value: 'Chaque joueur a 2 minutes pour jouer. Sinon, c\'est forfait (défaite automatique).' }
                    );
                break;

            case 'tictactoe':
                embed.setTitle('❌ Règles du Morpion (Tic-Tac-Toe)')
                    .setColor('#e67e22')
                    .setDescription('Le duel rapide pour régler des comptes.')
                    .addFields(
                        { name: '🎯 Objectif', value: 'Aligner **3 symboles** (❌ ou ⭕) sur la grille 3x3.' },
                        { name: '🎮 Comment Jouer', value: '1. Lance le défi : `/morpion adversaire:@Ami`\n2. L\'ami accepte.\n3. Jouez tour à tour en cliquant sur les cases.\n4. Le premier à aligner 3 gagne.' },
                        { name: '💰 Paris', value: 'Même principe : `/morpion adversaire:@Ami mise:1000`. Le gagnant prend tout.' }
                    );
                break;
        }

        await interaction.reply({ embeds: [embed], flags: [64] });
    }
};
