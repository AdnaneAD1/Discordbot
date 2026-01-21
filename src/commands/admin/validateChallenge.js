const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { completeChallenge } = require('../../systems/challenges');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('validatechallenge')
        .setDescription('Valide manuellement un défi pour un membre (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('user').setDescription('Le membre qui a réussi le défi').setRequired(true))
        .addStringOption(option => option.setName('challenge_id').setDescription('L\'ID du défi (récupérable via la base de données ou configuration)').setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const challengeId = interaction.options.getString('challenge_id');
        const member = await interaction.guild.members.fetch(targetUser.id);

        await interaction.deferReply({ flags: [64] });

        try {
            const result = await completeChallenge(member, challengeId);

            if (result.success) {
                return interaction.editReply({
                    content: `✅ Défi validé avec succès pour **${targetUser.username}** ! Il/Elle a reçu **${result.rewardXp} XP**.`
                });
            } else {
                return interaction.editReply({
                    content: `❌ Erreur : ${result.message}`
                });
            }
        } catch (error) {
            console.error(error);
            return interaction.editReply({
                content: '❌ Une erreur est survenue lors de la validation du défi.'
            });
        }
    },
};
