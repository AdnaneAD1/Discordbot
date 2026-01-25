const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Hunter extends Role {
    constructor() {
        super('hunter', 'Chasseur', '🔫', 'Si vous mourez, vous pouvez emmener quelqu\'un avec vous dans la tombe.', 'VILLAGE', 'hunter.png');
    }

    async onDeath(game, player, unixTimestamp) {
        // Le Chasseur interagit publiquement ou dans son thread ? 
        // La demande était "tous les fils privés". Mais le chasseur mort agit souvent en public pour le drama ou en privé.
        // Vu la configuration, on va utiliser le thread privé s'il est dispo, sinon public.
        const thread = game.playerThreads.get(player.id);
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && p.id !== player.id);

        if (alivePlayers.length === 0) return;

        const embed = new EmbedBuilder()
            .setTitle('🔫 Dernier souffle du Chasseur')
            .setDescription(`Vous êtes mort ! Choisissez une cible à abattre avant de partir...\n\n⏱️ **Fin de la phase :** ${unixTimestamp ? `<t:${unixTimestamp}:R>` : "Immédiat"}`)
            .setColor('#e67e22');

        const select = new StringSelectMenuBuilder()
            .setCustomId('lg_hunter_action')
            .setPlaceholder('Sélectionner une cible')
            .addOptions(alivePlayers.map(p => ({
                label: p.username,
                value: p.id
            })));

        const row = new ActionRowBuilder().addComponents(select);

        try {
            if (thread) {
                await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
            } else {
                // Fallback DM ou Thread
                await game.thread.send(`⚠️ <@${player.id}> (Chasseur), vérifie tes MP pour utiliser ton pouvoir !`);
            }
        } catch (e) {
            console.error(`Failed to send Hunter action to ${player.id}`, e);
        }
    }
}

module.exports = Hunter;
