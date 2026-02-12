const express = require('express');
const bodyParser = require('body-parser');
const { handlePayPalWebhook } = require('../services/paymentManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Utiliser body-parser pour récupérer le JSON
app.use(bodyParser.json());

// Endpoint de santé (pour Render/Uptimerobot)
app.get('/health', (req, res) => {
    res.status(200).send('OK - Bot is running');
});

// Endpoint Webhook PayPal
app.post('/api/webhooks/paypal', async (req, res) => {
    console.log('[Webhook] PayPal event received');
    try {
        const result = await handlePayPalWebhook(req);
        if (result.success) {
            res.status(200).send('Webhook processed');
        } else {
            console.error('[Webhook] Processing failed:', result.error);
            // On renvoie quand même 200 pour que PayPal ne re-spamme pas indéfiniment si c'est une erreur logique de notre côté
            res.status(200).send('Webhook processed with errors');
        }
    } catch (error) {
        console.error('[Webhook] Critical error:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Lance le serveur Express
 */
function startServer() {
    app.listen(PORT, () => {
        console.log(`[Server] Webhook server listening on port ${PORT}`);
    });
}

module.exports = { startServer, app };
