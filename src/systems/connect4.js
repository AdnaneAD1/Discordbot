
class Connect4 {
    constructor(player1, player2, wager = 0) {
        this.player1 = player1;
        this.player2 = player2;
        this.wager = wager;
        this.board = Array(6).fill(null).map(() => Array(7).fill(null)); // 6 lignes, 7 colonnes
        this.turn = player1.id; // Player 1 commence (Rouge)
        this.winner = null;
        this.isDraw = false;
    }

    // Joue un jeton dans une colonne (0-6)
    playMove(userId, colIndex) {
        if (userId !== this.turn) return { success: false, error: 'Pas ton tour !' };
        if (this.winner) return { success: false, error: 'Partie terminée.' };

        // Trouver la première case vide en partant du bas
        for (let row = 5; row >= 0; row--) {
            if (this.board[row][colIndex] === null) {
                this.board[row][colIndex] = userId;

                // Vérifier la victoire
                if (this.checkWin(row, colIndex, userId)) {
                    this.winner = userId;
                } else if (this.checkDraw()) {
                    this.isDraw = true;
                } else {
                    // Changer de tour
                    this.turn = (this.turn === this.player1.id) ? this.player2.id : this.player1.id;
                }

                return { success: true };
            }
        }

        return { success: false, error: 'Colonne pleine !' };
    }

    checkWin(row, col, userId) {
        // Directions: [rowDelta, colDelta]
        const directions = [
            [0, 1],  // Horizontal
            [1, 0],  // Vertical
            [1, 1],  // Diagonale descendante
            [1, -1]  // Diagonale montante
        ];

        for (let [dr, dc] of directions) {
            let count = 1; // Le jeton qu'on vient de poser

            // Vérifier dans une direction (+)
            for (let i = 1; i < 4; i++) {
                const r = row + (dr * i);
                const c = col + (dc * i);
                if (r < 0 || r >= 6 || c < 0 || c >= 7 || this.board[r][c] !== userId) break;
                count++;
            }

            // Vérifier dans la direction opposée (-)
            for (let i = 1; i < 4; i++) {
                const r = row - (dr * i);
                const c = col - (dc * i);
                if (r < 0 || r >= 6 || c < 0 || c >= 7 || this.board[r][c] !== userId) break;
                count++;
            }

            if (count >= 4) return true;
        }

        return false;
    }

    checkDraw() {
        return this.board[0].every(cell => cell !== null); // Si la ligne du haut est pleine
    }

    getBoardString() {
        let display = '';
        for (let row of this.board) {
            display += row.map(cell => {
                if (cell === this.player1.id) return '🔴';
                if (cell === this.player2.id) return '🟡';
                return '⚫';
            }).join(' ') + '\n';
        }
        display += '1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣'; // Indicateurs de colonnes
        return display;
    }
}

module.exports = Connect4;
