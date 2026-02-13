const { EmbedBuilder } = require('discord.js');

const formatTime = (ms) => {
    if (isNaN(ms) || ms <= 0) return '00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts = [];
    if (hours > 0) parts.push(hours);
    parts.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
    parts.push(seconds < 10 ? `0${seconds}` : seconds);

    return parts.join(':');
};

async function handleMusicInteraction(interaction) {
    const { customId } = interaction;
    const { getExistingPlayer, destroyPlayer, handleVoteSkip, playTrack } = require('../../services/music');
    const player = getExistingPlayer(interaction.guild.id);
    const action = customId.replace('music_', '');

    if (!player) return interaction.reply({ content: '❌ Plus de musique en cours.', flags: [64] });

    const { isGuildPremium } = require('../../services/subscriptions');
    const { Blackjack } = require('../../systems/casino');

    const subStatus = await isGuildPremium(interaction.guild.id);
    const isPremium = subStatus.isPremium;

    const COSTS = {
        'skip': 100,
        'back': 50,
        'stop': 50,
        'pause': 50,
        'loop': 20,
        'shuffle': 20
    };

    // Vérification et Paiement pour les serveurs Non-Premium
    if (!isPremium && COSTS[action]) {
        const cost = COSTS[action];
        const balance = await Blackjack.getBalance(interaction.user.id);

        if (balance < cost) {
            return interaction.reply({
                content: `❌ **Action Payante !**\nCe serveur n'est pas [Titan Server].\nIl te faut **${cost}** 🪙 pour cette action (Solde: ${balance}).`,
                flags: [64]
            });
        }

        // Paiement
        await Blackjack.updateBalance(interaction.user.id, -cost);
        // On continue l'exécution, mais on notifie du paiement
        await interaction.channel.send({ content: `💸 **${interaction.user.username}** a payé **${cost}** 🪙 pour utiliser **${action.toUpperCase()}** !` }).catch(() => { });
    }

    switch (action) {
        case 'back':
            const prevTrack = player.previousTrack();
            if (!prevTrack) return interaction.reply({ content: '❌ Pas de morceau précédent dans l\'historique.', flags: [64] });

            await playTrack(player, prevTrack);
            await interaction.reply({ content: '⏪ Retour au morceau précédent !' });
            break;
        case 'loop':
            let newLoop = 'none';
            if (player.loop === 'none') newLoop = 'track';
            else if (player.loop === 'track') newLoop = 'queue';

            player.loop = newLoop;
            const loopMessages = { 'none': 'désactivée', 'track': 'du morceau actuel', 'queue': 'de la file d\'attente' };
            await interaction.reply({ content: `🔁 Répétition **${loopMessages[newLoop]}** !` });
            break;
        case 'pause':
            const isPaused = player.connection.paused;
            player.connection.setPaused(!isPaused);
            await interaction.reply({ content: !isPaused ? '⏸️ Musique en pause' : '▶️ Musique reprise' });
            break;
        case 'stop':
            destroyPlayer(interaction.guild.id);
            await interaction.reply({ content: '⏹️ Musique arrêtée et file nettoyée.' });
            break;
        case 'skip':
            player.connection.stopTrack();
            await interaction.reply({ content: '⏭️ Morceau suivant !' });
            break;
        case 'queue':
            const currentTrack = player.current;
            const queue = player.queue;

            const qEmbed = new EmbedBuilder()
                .setColor('#febc11')
                .setTitle(`🎶 File d'attente - ${interaction.guild.name}`)
                .setThumbnail(currentTrack?.info?.artworkUrl || null);

            let qDescription = currentTrack ? `**En cours :**\n[${currentTrack.info.title}](${currentTrack.info.uri}) - \`${formatTime(currentTrack.info.length)}\`\n\n` : '';

            if (queue.length === 0) {
                qDescription += "*La file d'attente est vide.*";
            } else {
                qDescription += "**À venir :**\n";
                const tracks = queue.slice(0, 10).map((track, index) => {
                    return `**${index + 1}.** [${track.info.title}](${track.info.uri}) - \`${formatTime(track.info.length)}\``;
                });

                qDescription += tracks.join('\n');

                if (queue.length > 10) {
                    qDescription += `\n\n*...et ${queue.length - 10} autres morceaux.*`;
                }
            }

            const totalDuration = (currentTrack ? (currentTrack.info.length || 0) : 0) + queue.reduce((acc, track) => acc + (track.info?.length || 0), 0);
            qDescription += `\n\n**Total :** \`${queue.length + (currentTrack ? 1 : 0)}\` morceau(x) | **Durée totale :** \`${formatTime(totalDuration)}\``;

            qEmbed.setDescription(qDescription);
            await interaction.reply({ embeds: [qEmbed] });
            break;

        case 'voteskip':
            const vChannel = interaction.member.voice.channel;
            if (!vChannel) return interaction.reply({ content: '❌ Tu dois être dans un salon vocal.', flags: [64] });

            const voteResult = handleVoteSkip(player, interaction.user.id, vChannel);
            if (!voteResult.success) return interaction.reply({ content: `❌ ${voteResult.error}`, flags: [64] });

            if (voteResult.skipped) {
                await interaction.reply({ content: `🗳️ **Vote Skip réussi !** (${voteResult.current}/${voteResult.required}) - Morceau suivant !` });
            } else {
                await interaction.reply({ content: `🗳️ Vote enregistré ! (${voteResult.current}/${voteResult.required} votes nécessaires)` });
            }
            break;

        case 'shuffle':
            if (player.queue.length < 2) {
                return interaction.reply({ content: '❌ Pas assez de morceaux dans la file pour mélanger.', flags: [64] });
            }
            player.shuffle();
            await interaction.reply({ content: `🔀 File d'attente mélangée ! (${player.queue.length} morceaux)` });
            break;
    }
}

module.exports = { handleMusicInteraction };
