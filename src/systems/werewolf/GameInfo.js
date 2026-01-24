const { EmbedBuilder } = require('discord.js');

const GameInfo = {
    getRulesEmbed() {
        return new EmbedBuilder()
            .setTitle('📖 RÈGLES DU LOUP-GAROU')
            .setDescription('Bienvenue dans le village ! Un jeu de bluff, de psychologie et de survie.')
            .addFields(
                { name: '🎯 But du Jeu', value: '• **Villageois** : Éliminer tous les Loups-Garous.\n• **Loups-Garous** : Éliminer tous les villageois.\n• **Solitaires** : Atteindre leur propre condition de victoire (ex: Loup Blanc).' },
                { name: '⏳ Le Cycle', value: '1. **La Nuit** : Les rôles spéciaux agissent en secret. Les Loups choisissent une victime.\n2. **Le Jour** : Le village découvre les morts et débat.\n3. **Le Conseil** : Le village vote pour éliminer un suspect.' },
                { name: '🎖️ Le Maire', value: 'Élu le premier matin. Son vote compte double en cas d\'égalité lors du conseil.' }
            )
            .setColor('#2c3e50')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/1993/1993290.png');
    },

    getRolesEmbed() {
        return [
            new EmbedBuilder()
                .setTitle('🐺 LE CAMP DES LOUPS')
                .setDescription('Leur but : Dévorer tout le village sans se faire démasquer.')
                .addFields(
                    { name: '🐺 Loup-Garou', value: 'Le pilier du camp. Vote chaque nuit pour dévorer un villageois.' },
                    { name: '⚪ Loup Blanc', value: 'Traître parmi les siens. Peut dévorer un autre loup une nuit sur deux. Il gagne **SEUL** s\'il est le dernier survivant.' },
                    { name: '🖤 Loup Noir', value: 'Possède le pouvoir d\'**Infection**. Une fois par partie, il peut transformer la victime des loups en loup au lieu de la tuer.' },
                    { name: '🧙‍♂️ Sorcier', value: 'Allié occulte. Il connaît l\'identité de tous les loups dès le début et gagne avec eux, mais n\'est pas un loup lui-même.' }
                )
                .setColor('#c0392b'),

            new EmbedBuilder()
                .setTitle('⚖️ LE CAMP DU VILLAGE')
                .setDescription('Leur but : Identifier et éliminer tous les agents du chaos.')
                .addFields(
                    { name: '� Simple Villageois', value: 'N\'a pas de pouvoir spécial, mais son vote est crucial pour le village.' },
                    { name: '🔮 Voyante', value: 'Chaque nuit, elle observe l\'âme d\'un joueur pour découvrir son rôle exact.' },
                    { name: '🧪 Sorcière', value: 'Utilise ses potions : **Vie** pour ressusciter une victime, ou **Mort** pour éliminer un suspect.' },
                    { name: '🔫 Chasseur', value: 'Sa mort déclenche une ultime réaction : il peut abattre un joueur de son choix dans son dernier souffle.' },
                    { name: '🛡️ Garde', value: 'Protège un joueur contre les loups chaque nuit. Il ne peut pas protéger la même personne deux nuits de suite.' },
                    { name: '🐦 Corbeau', value: 'Maudit un joueur chaque nuit. La cible commencera le conseil du lendemain avec **2 votes contre elle**.' },
                    { name: '👴 Ancien', value: 'Survit à une attaque des loups. **Attention** : si le village l\'élimine, tous les villageois perdent leurs pouvoirs !' },
                    { name: '⚰️ Fossoyeur', value: 'Le lendemain d\'une élimination au conseil, il découvre le rôle exact de la personne tuée.' }
                )
                .setColor('#27ae60'),

            new EmbedBuilder()
                .setTitle('✨ LES RÔLES À MÉCANIQUES')
                .setDescription('Ces rôles apportent du chaos et des retournements de situation.')
                .addFields(
                    { name: '💘 Cupidon', value: 'Lien éternel. Désigne deux Amoureux. Si l\'un meurt, l\'autre succombe instantanément.' },
                    { name: '🧠 Mentaliste', value: 'Analyse les énergies. Il devine chaque nuit si les deux derniers morts appartenaient au même camp.' },
                    { name: '👑 Dictateur', value: 'Prend le pouvoir absolu. Une fois par partie, il peut décider **SEUL** de l\'issue du vote du conseil.' },
                    { name: '📜 Héritier', value: 'Choisit un mentor au début. Si celui-ci meurt, l\'héritier récupère son rôle et ses pouvoirs.' },
                    { name: '🏹 Enfant Sauvage', value: 'Adopte un modèle. Si son modèle meurt, son cœur s\'assombrit et il devient un Loup-Garou.' },
                    { name: '🔥 Pyromane', value: 'Cible solitaire. Gaze des joueurs chaque nuit et peut déclencher un **Incendie** pour les consumer tous d\'un coup. Gagne SEUL.' }
                )
                .setColor('#f1c40f')
        ];
    },

    getFlowEmbed() {
        return new EmbedBuilder()
            .setTitle('⚙️ DÉROULEMENT D\'UNE PARTIE')
            .addFields(
                { name: '1️⃣ Lancement', value: 'L\'hôte crée le lobby (`/lg create`). Les joueurs rejoignent puis l\'hôte lance la partie (`/lg start`).' },
                { name: '2️⃣ Distribution', value: 'Ton rôle t\'est envoyé en **Message Privé (MP)** avec une image unique. **Consulte bien tes MPs !**' },
                { name: '3️⃣ La Nuit', value: 'Les rôles spéciaux (Loups, Voyante...) agissent dans des fils privés. Vote en secret via les menus.' },
                { name: '4️⃣ Le Jour', value: 'Le village débat publiquement dans ce salon. Utilisez le bouton de vote pour éliminer un suspect.' }
            )
            .setFooter({ text: '💡 Conseil : Le bluff est autorisé (et même recommandé pour les loups !)' })
            .setColor('#3498db');
    },

    async sendAll(channel) {
        await channel.send({ embeds: [this.getRulesEmbed(), ...this.getRolesEmbed(), this.getFlowEmbed()] });
    }
};

module.exports = GameInfo;
