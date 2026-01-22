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
                return interaction.respond([{ name: 'Erreur: Serveur introuvable', value: 'error' }]);
            }

            const focusedValue = interaction.options.getFocused().toLowerCase();

            // Fetch active challenges for this guild (limit to 25 for performance)
            const challengesSnapshot = await db.collection('guilds')
                .doc(guildId)
                .collection('challenges')
                .where('active', '==', true)
                .limit(25)
                .get();

            if (challengesSnapshot.empty) {
                return interaction.respond([{
                    name: 'Aucun défi actif. Utilisez /addchallenge pour en créer.',
                    value: 'no_challenges'
                }]);
            }

            const challenges = [];
            const now = new Date();

            challengesSnapshot.forEach(doc => {
                const data = doc.data();

                // Check expiration
                const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (expiresAt < now) {
                    // Mark as expired in background (don't await to keep autocomplete fast)
                    doc.ref.update({ active: false }).catch(console.error);
                    return; // Skip expired challenges
                }

                if (data.title && data.rewardXp !== undefined) {
                    challenges.push({
                        name: `${data.title} (${data.rewardXp} XP)`,
                        value: doc.id
                    });
                }
            });

            if (challenges.length === 0) {
                return interaction.respond([{
                    name: 'Aucun défi valide trouvé',
                    value: 'no_valid_challenges'
                }]);
            }

            // Filter based on what the user is typing
            const filtered = challenges.filter(choice =>
                choice.name.toLowerCase().includes(focusedValue)
            ).slice(0, 25); // Discord limit

            await interaction.respond(filtered.length > 0 ? filtered : challenges.slice(0, 25));
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([{
                name: 'Erreur de chargement. Vérifiez les logs.',
                value: 'error'
            }]);
        }
    },
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const challengeId = interaction.options.getString('challenge');

        // Validate that a real challenge was selected
        if (!challengeId || challengeId === 'error' || challengeId === 'no_challenges' || challengeId === 'no_valid_challenges') {
            return interaction.reply({
                content: '❌ Veuillez sélectionner un défi valide dans la liste.',
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
