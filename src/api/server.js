const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Route de santé (Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

/**
 * Lance le serveur Express
 */
function startServer(client) {
    if (client) app.set('discordClient', client);

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Webhook/Health server listening on port ${PORT}`);
    });
}

module.exports = { startServer, app };
