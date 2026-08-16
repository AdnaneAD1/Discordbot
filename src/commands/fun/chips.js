const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Blackjack } = require('../../systems/casino');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chips')
        .setDescription('Consulte ton solde de jetons du Casino 🪙'),

    async execute(interaction) {
        const balance = await Blackjack.getBalance(interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('🪙 COFFRE-FORT CASINO')
            .setColor('#febc11')
            .setDescription(`Tu possèdes actuellement **${balance}** jetons.`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: 'Viens les dépenser au Blackjack ! 🎰' });

        await interaction.reply({ embeds: [embed], flags: [64] });
    },
};
