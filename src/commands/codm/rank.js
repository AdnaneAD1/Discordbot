const { db } = require('../../services/firebase');
const { CODM_GRADES } = require('../../systems/xp');

const gradesCache = new Map(); // guildId -> grades

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Affiche ton rang et ton XP CODM')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur à vérifier')),
    async execute(interaction) {
        const target = interaction.options.getMember('user') || interaction.member;

        const guildId = interaction.guild.id;
        const userDoc = await db.collection('guilds').doc(guildId).collection('users').doc(target.id).get();

        if (!userDoc.exists) {
            return interaction.reply({ content: 'Cet utilisateur n\'a pas encore d\'XP sur ce serveur.', flags: [64] });
        }

        // Fetch dynamic grades or use defaults with Cache
        let codmGrades = gradesCache.get(guildId);
        if (!codmGrades) {
            const gradesDoc = await db.collection('guilds').doc(guildId).collection('config').doc('grades').get();
            codmGrades = gradesDoc.exists ? gradesDoc.data().paliers : CODM_GRADES;
            gradesCache.set(guildId, codmGrades);
            setTimeout(() => gradesCache.delete(guildId), 5 * 60 * 1000);
        }

        const data = userDoc.data();
        const xp = data.xp || 0;
        const level = data.level || codmGrades[0].name;

        // Find next grade
        let nextGrade = "Max";
        let nextXp = xp;
        for (let i = 0; i < codmGrades.length; i++) {
            if (codmGrades[i].name === level && i < codmGrades.length - 1) {
                nextGrade = codmGrades[i + 1].name;
                nextXp = codmGrades[i + 1].xp;
                break;
            }
        }

        const currentGradeObj = codmGrades.find(g => g.name === level);
        const currentEmoji = currentGradeObj?.emoji || '🎖️';
        const progress = nextGrade === "Max" ? 100 : (xp / nextXp) * 100;
        const xpRemaining = nextGrade === "Max" ? 0 : nextXp - xp;
        const nextGradeObj = nextGrade === "Max" ? null : codmGrades.find(g => g.name === nextGrade);
        const nextEmoji = nextGradeObj?.emoji || '🎖️';

        const rankEmbed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle(`Profil CODM de ${target.user.username}`)
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
                { name: 'Grade', value: `${currentEmoji} \`${level}\``, inline: true },
                { name: 'XP Totale', value: `\`${xp}\` XP`, inline: true },
                { name: 'Prochain Grade', value: nextGrade === "Max" ? "🚀 `Grade Maximum atteint !`" : `${nextEmoji} \`${nextGrade}\` (\`${nextXp}\` XP)\n➡️ XP Restant : \`${xpRemaining}\``, inline: false },
            )
            .setFooter({ text: `Progression: ${progress.toFixed(1)}%` })
            .setTimestamp();

        await interaction.reply({ embeds: [rankEmbed] });
    },
};
