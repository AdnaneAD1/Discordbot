
class TicTacToe {
    constructor(player1, player2, wager = 0) {
        this.player1 = player1;
        this.player2 = player2;
        this.wager = wager;
        this.board = Array(9).fill(null); // 0-8
        this.turn = player1.id;
        this.winner = null;
        this.isDraw = false;
    }

    playMove(userId, index) {
        if (userId !== this.turn) return { success: false, error: 'Pas ton tour !' };
        if (this.winner || this.isDraw) return { success: false, error: 'Partie terminée.' };
        if (this.board[index] !== null) return { success: false, error: 'Case déjà prise !' };

        this.board[index] = userId;

        if (this.checkWin(userId)) {
            this.winner = userId;
        } else if (this.board.every(cell => cell !== null)) {
            this.isDraw = true;
        } else {
            this.turn = (this.turn === this.player1.id) ? this.player2.id : this.player1.id;
        }

        return { success: true };
    }

    checkWin(userId) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
            [0, 4, 8], [2, 4, 6]             // Diagonales
        ];

        return winPatterns.some(pattern =>
            pattern.every(index => this.board[index] === userId)
        );
    }
}

module.exports = TicTacToe;
