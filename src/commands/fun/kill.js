const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kill')
        .setDescription('Tue un utilisateur de manière aléatoire et tragique !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('L\'utilisateur à éliminer')
                .setRequired(true)),
    async execute(interaction) {
        const victim = interaction.options.getUser('cible');
        const killer = interaction.user;

        if (victim.id === killer.id) {
            return interaction.reply({ content: "Tu ne peux pas te suicider ici, la vie est belle ! 🌸", flags: [64] });
        }

        const deathMessages = [
            `${killer} a écrasé ${victim} avec un tank de CODM en plein milieu du salon.`,
            `${killer} a envoyé un missile Predator sur ${victim} alors qu'il rechargeait.`,
            `${killer} a éliminé ${victim} avec un couteau de lancer depuis l'autre bout de la map.`,
            `${killer} a piégé le colis stratégique de ${victim} qui a explosé au moment de l'ouverture.`,
            `${killer} a fait tomber un piano sur la tête de ${victim} en plein duel.`,
            `${killer} a glissé une peau de banane sous les pieds de ${victim} devant un gouffre.`,
            `${killer} a convaincu ${victim} que les grenades étaient des pommes. C'était une erreur fatale.`,
            `${killer} a piraté les écouteurs de ${victim} pour mettre du JUL à fond, provoquant une mort cérébrale immédiate.`,
            `${killer} a défié ${victim} en duel de regard, mais a triché en utilisant un flashbang.`,
            `${killer} a invoqué un vortex temporel qui a envoyé ${victim} à l'époque où les dinosaures avaient faim.`,
            `${killer} a remplacé les munitions de ${victim} par des confettis en pleine zone de combat.`,
            `${killer} a téléporté ${victim} directement dans le coffre d'un avion en plein vol.`,
            `${killer} a utilisé une attaque "Petit doigt dans l'œil" sur ${victim}, qui a succombé de douleur.`,
            `${killer} a fait spawn 50 bots niveau max sur la position de ${victim}.`
        ];

        const randomMessage = deathMessages[Math.floor(Math.random() * deathMessages.length)];

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('💀 UN CRIME A ÉTÉ COMMIS !')
            .setDescription(randomMessage)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    },
};
