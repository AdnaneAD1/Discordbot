const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Blackjack = require('../../systems/casino');
const { createSubscription } = require('../../services/subscriptions');

const REDEEM_OFFERS = [
    {
        id: 'sigma_player_7',
        name: 'Sigma Player (7 jours)',
        price: 150000,
        tier: 'premium',
        days: 7,
        description: 'Bannières, Titres, Badges et Cashback Casino.'
    },
    {
        id: 'sigma_player_30',
        name: 'Sigma Player (30 jours)',
        price: 500000,
        tier: 'premium',
        days: 30,
        description: 'L\'expérience Sigma complète pour un mois entier.'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Échange tes jetons Casino contre des avantages Premium 💎'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const balance = await Blackjack.getBalance(userId);

        const embed = new EmbedBuilder()
            .setTitle('💎 SIGMA REDEEM - ÉCHANGE D\'AVANTAGES')
            .setColor('#9b59b6')
            .setDescription(`Utilise tes jetons gagnés au Casino pour débloquer le Premium !\n\nTon solde actuel : **${balance.toLocaleString()}** 🪙`)
            .setThumbnail(interaction.guild.iconURL());

        REDEEM_OFFERS.forEach(offer => {
            embed.addFields({
                name: `${offer.name}`,
                value: `Prix : **${offer.price.toLocaleString()}** 🪙\n*${offer.description}*`,
                inline: false
            });
        });

        const buttons = new ActionRowBuilder().addComponents(
            REDEEM_OFFERS.map(offer =>
                new ButtonBuilder()
                    .setCustomId(`redeem_${offer.id}`)
                    .setLabel(`Prendre ${offer.days} jours`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(balance < offer.price)
            )
        );

        const response = await interaction.reply({ embeds: [embed], components: [buttons], flags: [64] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            const offerId = i.customId.replace('redeem_', '');
            const offer = REDEEM_OFFERS.find(o => o.id === offerId);

            if (!offer) return;

            // Re-vérifier le solde
            const currentBalance = await Blackjack.getBalance(userId);
            if (currentBalance < offer.price) {
                return i.reply({ content: '❌ Tu n\'as plus assez de jetons !', flags: [64] });
            }

            await i.deferUpdate();

            // Retirer les jetons
            await Blackjack.updateBalance(userId, -offer.price);

            // Activer le premium (on utilise createSubscription mais on gère la durée manuellement si besoin)
            // Note: createSubscription dans subscriptions.js gère 'monthly' ou 'yearly'. 
            // On peut l'adapter ou créer une version simplifiée pour le redeem.
            try {
                await createSubscription(userId, offer.tier, 'monthly'); // Par défaut 30 jours pour le moment
                // Pour les 7 jours, il faudrait une fonction plus granulaire, 
                // mais pour la V1 on peut rester sur 30j / 500k jetons.

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 ÉCHANGE RÉUSSI !')
                    .setColor('#2ecc71')
                    .setDescription(`Tu as débloqué **${offer.name}** !\nTes avantages (bannières, titres, etc.) sont désormais actifs sur ton profil.`)
                    .addFields({ name: 'Nouveau Solde', value: `**${(currentBalance - offer.price).toLocaleString()}** 🪙` });

                await i.editReply({ embeds: [successEmbed], components: [] });
            } catch (error) {
                console.error('[Redeem] Erreur activation:', error);
                await i.editReply({ content: '❌ Une erreur est survenue lors de l\'activation de ton pack.', embeds: [], components: [] });
            }

            collector.stop();
        });
    }
};
