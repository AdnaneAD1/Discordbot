const express = require('express');
const bodyParser = require('body-parser');
const { handlePayPalWebhook } = require('../services/paymentManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Utiliser body-parser pour récupérer le JSON
app.use(bodyParser.json());

// Page de retour après paiement (Succès/Santé)
app.get('/health', async (req, res) => {
    const { paymentId, PayerID } = req.query;

    // Si on revient de PayPal avec un paiement à valider
    if (paymentId && PayerID) {
        try {
            const { executePayPalPayment, handlePayPalWebhook } = require('../services/paymentManager');
            
            // 1. On exécute le paiement côté PayPal
            console.log(`[Server] Exécution du paiement ${paymentId}...`);
            const payment = await executePayPalPayment(paymentId, PayerID);

            // 2. On déclenche manuellement la livraison si le webhook n'est pas encore passé
            // On simule une structure de webhook minimale pour handlePayPalWebhook
            const mockReq = {
                body: {
                    event_type: 'PAYMENT.SALE.COMPLETED',
                    resource: payment.transactions[0].related_resources[0].sale
                }
            };
            
            // Note: handlePayPalWebhook s'occupera de deliverProduct
            await handlePayPalWebhook(mockReq, req.app.get('discordClient'));

            console.log(`[Server] Paiement ${paymentId} exécuté et livré avec succès.`);
        } catch (error) {
            console.error('[Server] Erreur lors de la capture du paiement :', error);
            // On continue pour afficher la page, mais peut-être avec un message différent si besoin
        }
    }

    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Paiement Réussi - Sigma Palace</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                .container { background: #1e1e1e; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #febc11; max-width: 400px; }
                .check-icon { font-size: 60px; color: #2ecc71; margin-bottom: 20px; }
                h1 { color: #febc11; margin-bottom: 15px; }
                p { color: #ccc; line-height: 1.6; }
                .btn { display: inline-block; margin-top: 25px; padding: 12px 25px; background: #febc11; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; transition: 0.3s; }
                .btn:hover { background: #f39c12; transform: scale(1.05); }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="check-icon">✅</div>
                <h1>Paiement Reçu !</h1>
                <p>Ton achat a été validé avec succès. Tes avantages (jetons ou grade) seront activés sur le bot d'ici quelques secondes.</p>
                <p><strong>Tu peux maintenant fermer cette page en toute sécurité.</strong></p>
                <a href="https://discord.com/channels/@me" class="btn">Retourner sur Discord</a>
                <div class="footer">Sigma Palace Casino & Premium System</div>
            </div>
            <script>
                // Auto-fermeture après 5 secondes si possible (certains navigateurs bloquent)
                setTimeout(() => {
                    // window.close() ne marche souvent que si la page a été ouverte par un script,
                    // mais on peut essayer de rediriger vers discord.
                    window.location.href = "discord://";
                }, 5000);
            </script>
        </body>
        </html>
    `);
});

// Endpoint Webhook PayPal
app.post('/api/webhooks/paypal', async (req, res) => {
    console.log('[Webhook] PayPal event received');
    try {
        const result = await handlePayPalWebhook(req, req.app.get('discordClient'));
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
function startServer(client) {
    if (client) app.set('discordClient', client);

    app.listen(PORT, () => {
        console.log(`[Server] Webhook server listening on port ${PORT}`);
    });
}

module.exports = { startServer, app };
