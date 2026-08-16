const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gallery')
        .setDescription('Affiche la galerie des images générées par l\'IA')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Filtrer la galerie par utilisateur')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        let query = db.collection('ai_gallery').where('guildId', '==', guildId);

        if (targetUser) {
            query = query.where('userId', '==', targetUser.id);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').limit(20).get().catch(err => {
            console.error('[Gallery] Firestore query error:', err);
            return null;
        });

        if (!snapshot || snapshot.empty) {
            return interaction.editReply(
                targetUser
                    ? `❌ Aucune image générée par **${targetUser.username}** n'a été trouvée dans la galerie.`
                    : '❌ Aucune image n\'a encore été générée sur ce serveur.'
            );
        }

        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let currentIndex = 0;

        const generateEmbed = (index) => {
            const item = items[index];
            return new EmbedBuilder()
                .setTitle(`🎨 Galerie IA - Image ${index + 1}/${items.length}`)
                .setDescription(`**Prompt :** ${item.prompt}`)
                .addFields(
                    { name: 'Créateur', value: `<@${item.userId}> (${item.username})`, inline: true },
                    { name: 'Style', value: `\`${item.style || 'Standard'}\``, inline: true }
                )
                .setImage(item.imageUrl)
                .setColor('#9b59b6')
                .setTimestamp(item.createdAt ? item.createdAt.toDate() : new Date())
                .setFooter({ text: 'Open Discord Bot Gallery' });
        };

        const generateButtons = (index) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('gallery_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId('gallery_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === items.length - 1)
            );
        };

        const msg = await interaction.editReply({
            embeds: [generateEmbed(currentIndex)],
            components: [generateButtons(currentIndex)]
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000 // 1 minute
        });

        collector.on('collect', async i => {
            if (i.customId === 'gallery_prev') {
                currentIndex--;
            } else if (i.customId === 'gallery_next') {
                currentIndex++;
            }

            await i.update({
                embeds: [generateEmbed(currentIndex)],
                components: [generateButtons(currentIndex)]
            });
        });

        collector.on('end', async () => {
            await interaction.editReply({
                components: []
            }).catch(() => {});
        });
    }
};
