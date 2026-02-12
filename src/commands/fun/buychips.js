const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BUNDLES = [
    {
        name: 'Pack SIGMA PLAYER 💎',
        chips: '120,000',
        price: '7.99€',
        bonus: '30 jours de [Sigma Player] + Badge PRO inclus !',
        link: 'https://paypal.me/tonlien/7.99'
    },
    {
        name: 'Pack TITAN SERVER 👑',
        chips: '500,000',
        price: '19.99€',
        bonus: '30 jours de [Titan Server] + Rôle Prestige inclus !',
        link: 'https://paypal.me/tonlien/19.99'
    }
];

const TOP_UPS = [
    {
        name: 'Petite Recharge 🪙',
        chips: '35,000',
        price: '2.99€',
        link: 'https://paypal.me/tonlien/2.99'
    },
    {
        name: 'Grosse Recharge 💰',
        chips: '150,000',
        price: '9.99€',
        link: 'https://paypal.me/tonlien/9.99'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buychips')
        .setDescription('Achète des jetons pour le Sigma Palace Casino 🪙💎'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('💎 SIGMA PALACE - BOUTIQUE DE JETONS')
            .setColor('#febc11')
            .setDescription('Choisis ton pack pour continuer l\'aventure ! Si tu as déjà un abonnement, prends une **Recharge** pour ajouter uniquement des jetons.')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2489/2489756.png');

        embed.addFields({ name: '🎁 PACKS BUNDLES (Jetons + Grade)', value: '\u200b' });
        BUNDLES.forEach(pack => {
            embed.addFields({
                name: `${pack.name} - ${pack.price}`,
                value: `🪙 **${pack.chips}** jetons\n🎁 ${pack.bonus}`,
                inline: false
            });
        });

        embed.addFields({ name: '🪙 RECHARGES (Jetons seuls)', value: '\u200b' });
        TOP_UPS.forEach(pack => {
            embed.addFields({
                name: `${pack.name} - ${pack.price}`,
                value: `🪙 **${pack.chips}** jetons`,
                inline: true
            });
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Accéder à la Boutique')
                .setURL('https://ton-site-ou-boutique.com') // À personnaliser
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setCustomId('contact_staff')
                .setLabel('Aide / Contact Staff')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
    },
};
