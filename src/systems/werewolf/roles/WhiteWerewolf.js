const Role = require('../Role');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

class WhiteWerewolf extends Role {
    constructor() {
        super('white_werewolf', 'Loup Blanc', '⚪', 'Vous gagnez SEUL. Chaque deux nuits, vous pouvez choisir de dévorer un autre Loup-Garou.', 'WHITE_WEREWOLF');
    }

    async onNight(game, player, unixTimestamp, thread) {
        // Le loup blanc agit une nuit sur deux
        if (game.turn % 2 === 0) {
            const wolves = Array.from(game.players.values()).filter(p => p.isAlive && p.role.team === 'WEREWOLF' && p.id !== player.id);

            if (wolves.length === 0) return;

            const embed = new EmbedBuilder()
                .setTitle('⚪ Faim du Loup Blanc')
                .setDescription(`C'est votre nuit ! Voulez-vous dévorer l'un de vos "frères" ?\n\n⏱️ **Fin de la nuit :** <t:${unixTimestamp}:R>`)
                .setColor('#ffffff');

            const select = new StringSelectMenuBuilder()
                .setCustomId('lg_white_wolf_action')
                .setPlaceholder('Sélectionner un loup (Optionnel)')
                .addOptions([
                    { label: 'Ne personne tuer', value: 'skip' },
                    ...wolves.map(p => ({
                        label: p.username,
                        value: p.id
                    }))
                ]);

            const row = new ActionRowBuilder().addComponents(select);

            try {
                return await thread.send({ content: `<@${player.id}>`, embeds: [embed], components: [row] });
            } catch (e) {
                console.error(`Failed to send White Wolf action to ${player.id}`, e);
            }
        }
    }
}

module.exports = WhiteWerewolf;
