const { db } = require('../services/firebase');

const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Blackjack {
    static createDeck() {
        let deck = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                deck.push({ suit, value });
            }
        }
        return deck.sort(() => Math.random() - 0.5);
    }

    static calculateScore(hand) {
        let score = 0;
        let aces = 0;

        for (let card of hand) {
            if (card.value === 'A') {
                aces += 1;
                score += 11;
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                score += 10;
            } else {
                score += parseInt(card.value);
            }
        }

        while (score > 21 && aces > 0) {
            score -= 10;
            aces -= 1;
        }

        return score;
    }

    static formatHand(hand) {
        return hand.map(c => `[\`${c.value}${c.suit}\`](http://sigma)`).join(' ');
    }

    // Gestion des jetons Casino
    static async getBalance(userId) {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({ casinoChips: 1000 }); // Bonus de bienvenue
            return 1000;
        }
        return doc.data().casinoChips ?? 1000;
    }

    static async updateBalance(userId, amount) {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        const current = doc.exists ? (doc.data().casinoChips ?? 1000) : 1000;
        await userRef.set({ casinoChips: current + amount }, { merge: true });
        return current + amount;
    }

    static async getLeaderboard() {
        const snapshot = await db.collection('users')
            .orderBy('casinoChips', 'desc')
            .limit(10)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            chips: doc.data().casinoChips || 0
        }));
    }
}


class Roulette {
    static get WHEEL() {
        return [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
    }

    static getColor(number) {
        if (number === 0) return 'green';
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        return redNumbers.includes(number) ? 'red' : 'black';
    }

    static getEmoji(number) {
        const color = this.getColor(number);
        if (color === 'green') return '🟢';
        if (color === 'red') return '🔴';
        return '⚫';
    }

    static spin() {
        const randomIndex = Math.floor(Math.random() * this.WHEEL.length);
        return this.WHEEL[randomIndex];
    }

    static calculatePayout(betType, betValue, resultNumber) {
        const resultColor = this.getColor(resultNumber);

        if (betType === 'color') {
            if (betValue === resultColor && resultNumber !== 0) return 2; // x2 pour Rouge/Noir
        } else if (betType === 'number') {
            if (parseInt(betValue) === resultNumber) return 36; // x36 pour le bon numéro
        } else if (betType === 'parity') {
            const isEven = resultNumber % 2 === 0 && resultNumber !== 0;
            if ((betValue === 'even' && isEven) || (betValue === 'odd' && !isEven && resultNumber !== 0)) return 2;
        }

        return 0; // Perdu
    }
}

module.exports = { Blackjack, Roulette };
