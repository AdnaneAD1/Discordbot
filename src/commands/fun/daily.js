const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Blackjack = require('../../systems/casino');
const { db } = require('../../services/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Récupère ton bonus quotidien de jetons Casino 🪙'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        const now = new Date();
        const lastDaily = doc.exists ? doc.data().lastDaily?.toDate() : null;

        if (lastDaily && now.getTime() - lastDaily.getTime() < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

            return interaction.reply({
                content: `⏳ Tu as déjà récupéré ton bonus ! Reviens dans **${hours}h ${minutes}m**.`,
                flags: [64]
            });
        }

        const bonus = 500;
        await userRef.set({
            casinoChips: (doc.exists ? (doc.data().casinoChips || 1000) : 1000) + bonus,
            lastDaily: now
        }, { merge: true });

        const embed = new EmbedBuilder()
            .setTitle('🎁 BONUS QUOTIDIEN')
            .setColor('#2ecc71')
            .setDescription(`Félicitations ! Tu as reçu **${bonus}** jetons 🪙.`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2953/2953363.png')
            .setFooter({ text: 'Bonne chance aux tables ! 🎰' });

        await interaction.reply({ embeds: [embed] });
    },
};
