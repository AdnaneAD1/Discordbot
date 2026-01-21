const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuprules')
        .setDescription('Affiche le message de règlement avec le bouton d\'acceptation')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const rulesEmbed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('📜 RÈGLEMENT DU SERVEUR')
            .setDescription(
                'Bienvenue parmi nous ! Pour maintenir une communauté saine, merci de respecter les règles suivantes :\n\n' +
                '1️⃣ **Respect & Politesse** : Pas d\'insultes ou de harcèlement.\n' +
                '2️⃣ **Pas de Spam** : Évitez le flood et les majuscules abusives.\n' +
                '3️⃣ **Contenu approprié** : Pas de contenu NSFW ou illégal.\n' +
                '4️⃣ **Publicité interdite** : Sauf dans les salons dédiés.\n\n' +
                'En cliquant sur le bouton ci-dessous, vous acceptez de respecter ces règles.'
            )
            .setFooter({ text: 'CODM Streamer Bot' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accept_rules')
                    .setLabel('✅ J\'ACCEPTE LE RÈGLEMENT')
                    .setStyle(ButtonStyle.Success),
            );

        await interaction.reply({ embeds: [rulesEmbed], components: [row] });
    },
};
