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
        try {
            const guildId = interaction.guild?.id;
            if (!guildId) {
                return interaction.respond([]);
            }

            const focusedValue = interaction.options.getFocused().toLowerCase();

            // Fetch active challenges - FAST query, no expiration check here
            const challengesSnapshot = await db.collection('guilds')
                .doc(guildId)
                .collection('challenges')
                .where('active', '==', true)
                .limit(25)
                .get();

            if (challengesSnapshot.empty) {
                return interaction.respond([{
                    name: 'Aucun défi actif',
                    value: 'no_challenges'
                }]);
            }

            const challenges = [];
            challengesSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.title && data.rewardXp !== undefined) {
                    challenges.push({
                        name: `${data.title} (${data.rewardXp} XP)`,
                        value: doc.id
                    });
                }
            });

            if (challenges.length === 0) {
                return interaction.respond([{
                    name: 'Aucun défi valide',
                    value: 'no_valid'
                }]);
            }

            // Filter based on user input
            const filtered = focusedValue
                ? challenges.filter(c => c.name.toLowerCase().includes(focusedValue)).slice(0, 25)
                : challenges.slice(0, 25);

            await interaction.respond(filtered.length > 0 ? filtered : [{ name: 'Aucun résultat', value: 'none' }]);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const challengeId = interaction.options.getString('challenge');

        // Validate selection
        if (!challengeId || ['no_challenges', 'no_valid', 'none'].includes(challengeId)) {
            return interaction.reply({
                content: '❌ Aucun défi valide sélectionné. Créez d\'abord un défi avec `/addchallenge`.',
                ephemeral: true
            });
        }

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
