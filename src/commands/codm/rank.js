const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../services/firebase');
const { CODM_GRADES } = require('../../systems/xp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Affiche ton rang et ton XP CODM')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur à vérifier')),
    async execute(interaction) {
        const target = interaction.options.getMember('user') || interaction.member;

        const userDoc = await db.collection('users').doc(target.id).get();

        if (!userDoc.exists) {
            return interaction.reply({ content: 'Cet utilisateur n\'a pas encore d\'XP.', ephemeral: true });
        }

        const data = userDoc.data();
        const xp = data.xp || 0;
        const level = data.level || "Recrue I";

        // Find next grade
        let nextGrade = "Max";
        let nextXp = xp;
        for (let i = 0; i < CODM_GRADES.length; i++) {
            if (CODM_GRADES[i].name === level && i < CODM_GRADES.length - 1) {
                nextGrade = CODM_GRADES[i + 1].name;
                nextXp = CODM_GRADES[i + 1].xp;
                break;
            }
        }

        const progress = nextGrade === "Max" ? 100 : (xp / nextXp) * 100;

        const rankEmbed = new EmbedBuilder()
            .setColor('#febc11')
            .setTitle(`Profil CODM de ${target.user.username}`)
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
                { name: 'Grade', value: `\`${level}\``, inline: true },
                { name: 'XP Totale', value: `\`${xp}\` XP`, inline: true },
                { name: 'Prochain Grade', value: `\`${nextGrade}\` (${nextXp} XP)`, inline: false },
            )
            .setFooter({ text: `Progression: ${progress.toFixed(1)}%` })
            .setTimestamp();

        await interaction.reply({ embeds: [rankEmbed] });
    },
};
