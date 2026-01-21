const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertit un membre')
        .addUserOption(option => option.setName('user').setDescription('Le membre à avertir').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('La raison de l\'avertissement').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        // Save to DB
        const warnRef = db.collection('users').doc(user.id).collection('warnings');
        await warnRef.add({
            moderatorId: interaction.user.id,
            reason: reason,
            createdAt: new Date(),
        });

        // Get total warns
        const snapshot = await warnRef.get();
        const warnCount = snapshot.size;

        const warnEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('⚠️ AVERTISSEMENT')
            .setDescription(`Le membre ${user} a reçu un avertissement.`)
            .addFields(
                { name: 'Raison', value: reason },
                { name: 'Total avertissements', value: `${warnCount}` },
                { name: 'Modérateur', value: `${interaction.user.tag}` }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [warnEmbed] });

        // DM the user
        try {
            await user.send(`Vous avez reçu un avertissement sur le serveur de CODM Streamer.\nRaison : ${reason}\nTotal : ${warnCount}`);
        } catch (e) {
            console.log('Could not send DM to user');
        }
    },
};
