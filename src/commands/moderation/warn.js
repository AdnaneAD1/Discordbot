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
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason');

        if (!member) {
            return interaction.reply({ content: '❌ Ce membre n\'existe pas ou n\'est plus sur le serveur.', flags: [64] });
        }

        const { addWarning } = require('../../systems/moderation');

        // Exécuter l'avertissement et vérifier les sanctions
        const { warnCount, sanctionMessage } = await addWarning(member, reason, interaction.user.id, interaction.channel);

        const warnEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('⚠️ AVERTISSEMENT')
            .setDescription(`Le membre ${member.user} a reçu un avertissement.`)
            .addFields(
                { name: 'Raison', value: reason },
                { name: 'Total avertissements', value: `${warnCount}` },
                { name: 'Modérateur', value: `${interaction.user.tag}` }
            )
            .setTimestamp();

        if (sanctionMessage) {
            warnEmbed.addFields({ name: 'Sanction Automatique', value: sanctionMessage });
        }

        await interaction.reply({ embeds: [warnEmbed] });
    },
};
