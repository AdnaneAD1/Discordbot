const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { completeChallenge } = require('../../systems/challenges');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('validatechallenge')
        .setDescription('Valide manuellement un défi pour un membre (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('user').setDescription('Le membre qui a réussi le défi').setRequired(true))
        .addStringOption(option =>
            option.setName('challenge')
                .setDescription('Sélectionne le défi à valider')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        const guildId = interaction.guild.id;
        const focusedValue = interaction.options.getFocused().toLowerCase();

        try {
            // Fetch active challenges for this guild
            const challengesSnapshot = await db.collection('guilds')
                .doc(guildId)
                .collection('challenges')
                .where('active', '==', true)
                .get();

            const challenges = [];
            challengesSnapshot.forEach(doc => {
                const data = doc.data();
                challenges.push({
                    name: `${data.title} (${data.rewardXp} XP)`,
                    value: doc.id
                });
            });

            // Filter based on what the user is typing
            const filtered = challenges.filter(choice =>
                choice.name.toLowerCase().includes(focusedValue)
            ).slice(0, 25); // Discord limit

            await interaction.respond(filtered);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const challengeId = interaction.options.getString('challenge');
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
