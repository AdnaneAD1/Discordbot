const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { PRODUCTS, createPayPalPayment } = require('../../services/paymentManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buychips')
        .setDescription('Ouvre la boutique Sigma Palace 💎 (Jetons & Premium)'),

    async execute(interaction) {
        const userId = interaction.user.id;

        const mainEmbed = new EmbedBuilder()
            .setTitle('🏛️ SIGMA PALACE - BOUTIQUE OFFICIELLE')
            .setColor('#febc11')
            .setDescription('Bienvenue dans la boutique ! Choisis une catégorie ci-dessous pour découvrir nos offres.')
            .addFields(
                { name: '🪙 Jetons', value: 'Recharges pour le casino.', inline: true },
                { name: '💎 Premium', value: 'Abonnements et grades.', inline: true },
                { name: '🎁 Bundles', value: 'Jetons + Grades au meilleur prix.', inline: true }
            )
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2489/2489756.png')
            .setFooter({ text: 'Paiements sécurisés via PayPal' });

        const categoryRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('shop_category')
                .setPlaceholder('Choisir une catégorie...')
                .addOptions([
                    { label: 'Jetons (Recharges)', value: 'consumable', emoji: '🪙', description: 'Recharge ton solde de casino' },
                    { label: 'Abonnements Premium', value: 'subscription', emoji: '✨', description: 'Accès aux fonctions HD et illimitées' },
                    { label: 'Packs Bundles', value: 'bundle', emoji: '🎁', description: 'Le meilleur des deux mondes' }
                ])
        );

        const response = await interaction.reply({
            embeds: [mainEmbed],
            components: [categoryRow],
            flags: [64]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async i => {
            if (i.customId === 'shop_category') {
                const category = i.values[0];
                const filteredProducts = Object.entries(PRODUCTS).filter(([_, p]) => p.type === category);

                const productMenu = new StringSelectMenuBuilder()
                    .setCustomId('shop_product')
                    .setPlaceholder('Choisir un produit...')
                    .addOptions(filteredProducts.map(([sku, p]) => ({
                        label: `${p.name} - ${p.price}€`,
                        value: sku,
                        emoji: p.emoji || '📦',
                        description: p.description
                    })));

                const productRow = new ActionRowBuilder().addComponents(productMenu);

                // Garder la ligne de catégorie pour pouvoir changer
                await i.update({
                    content: `📂 Catégorie sélectionnée : **${category === 'consumable' ? 'Jetons' : category === 'subscription' ? 'Abonnement' : 'Bundle'}**`,
                    components: [categoryRow, productRow]
                });
            }

            else if (i.customId === 'shop_product') {
                const sku = i.values[0];
                const product = PRODUCTS[sku];

                await i.update({ content: `⏳ Génération de ton lien de paiement unique pour **${product.name}**...`, components: [] });

                try {
                    const payment = await createPayPalPayment(userId, sku);

                    const payEmbed = new EmbedBuilder()
                        .setTitle('💳 Prêt pour le paiement !')
                        .setColor('#0070ba') // Bleu PayPal
                        .setDescription(`Tu as sélectionné : **${product.name}**\nPrix : **${product.price}€**\n\nClique sur le bouton ci-dessous pour finaliser l'achat sur PayPal.`)
                        .addFields({ name: '📝 Note', value: 'Une fois payé, tes avantages seront crédités automatiquement sous 1-2 minutes.' })
                        .setFooter({ text: 'Session expirant dans 15 minutes' });

                    const payRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel(`Payer ${product.price}€ sur PayPal`)
                            .setURL(payment.url)
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('🖱️'),
                        new ButtonBuilder()
                            .setCustomId('shop_cancel')
                            .setLabel('Annuler')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await i.editReply({
                        content: '',
                        embeds: [payEmbed],
                        components: [payRow]
                    });

                    collector.stop('payment_generated');
                } catch (error) {
                    console.error('Erreur boutique:', error);
                    await i.editReply({ content: '❌ Erreur lors de la génération du paiement. Réessaie plus tard.', embeds: [], components: [] });
                }
            } else if (i.customId === 'shop_cancel') {
                await i.update({ content: '❌ Achat annulé.', embeds: [], components: [] });
                collector.stop('cancelled');
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏳ Temps écoulé. Utilise `/buychips` à nouveau !', components: [] }).catch(() => { });
            }
        });
    },
};
