const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class Hunter extends Role {
    constructor() {
        super('hunter', 'Chasseur', '🔫', 'Si vous mourez, vous pouvez emmener quelqu\'un avec vous dans la tombe.', 'VILLAGE', 'hunter.png');
    }

    async onDeath(game, player, unixTimestamp) {
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
            const user = await game.client.users.fetch(player.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error(`Failed to send Hunter action to ${player.id}`, e);
            // Si on ne peut pas envoyer de MP, on envoie dans le thread principal
            await game.thread.send(`⚠️ <@${player.id}> (Chasseur), vérifie tes MP pour utiliser ton pouvoir !`);
        }
    }
}

module.exports = Hunter;
