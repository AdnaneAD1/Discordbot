const paypal = require('paypal-rest-sdk');
const { db } = require('./firebase');
const { Blackjack } = require('../systems/casino');
const { createSubscription } = require('./subscriptions');

// Configuration PayPal
paypal.configure({
    'mode': process.env.PAYPAL_MODE || 'sandbox', // 'sandbox' ou 'live'
    'client_id': process.env.PAYPAL_CLIENT_ID,
    'client_secret': process.env.PAYPAL_CLIENT_SECRET
});

const PRODUCTS = {
    // --- RECHARGES (Jetons seuls) ---
    'chips_small': {
        name: 'Petite Recharge (35k)',
        price: '2.99',
        currency: 'EUR',
        type: 'consumable',
        amount: 35000
    },
    'chips_medium': {
        name: 'Moyenne Recharge (150k)', // Aligné avec buychips
        price: '9.99',
        currency: 'EUR',
        type: 'consumable',
        amount: 150000
    },
    'chips_large': {
        name: 'Grosse Recharge (500k)',
        price: '29.99',
        currency: 'EUR',
        type: 'consumable',
        amount: 500000
    },

    // --- PACKS BUNDLES (Jetons + Grade) ---
    'bundle_sigma': {
        name: 'Pack SIGMA PLAYER 💎', // Aligné avec buychips
        price: '7.99',
        currency: 'EUR',
        type: 'bundle',
        tier: 'premium',
        amount: 120000 // 120k jetons
    },
    'bundle_titan': {
        name: 'Pack TITAN SERVER 👑', // Aligné avec buychips
        price: '19.99',
        currency: 'EUR',
        type: 'bundle',
        tier: 'premium_plus',
        amount: 500000 // 500k jetons
    },

    // --- ABONNEMENTS SEULS (Via /premium) ---
    'sub_sigma': {
        name: 'Abonnement Sigma (1 Mois)',
        price: '4.99',
        currency: 'EUR',
        type: 'subscription',
        tier: 'premium',
        cycle: 'monthly'
    },
    'sub_titan': {
        name: 'Abonnement Titan (1 Mois)',
        price: '9.99',
        currency: 'EUR',
        type: 'subscription',
        tier: 'premium_plus',
        cycle: 'monthly'
    }
};

/**
 * Crée un paiement PayPal
 */
async function createPayPalPayment(userId, sku) {
    const product = PRODUCTS[sku];
    if (!product) throw new Error('Produit inconnu');

    const create_payment_json = {
        "intent": "sale",
        "payer": { "payment_method": "paypal" },
        "redirect_urls": {
            "return_url": "https://discord.com/channels/@me", // Redirection fictive vers Discord
            "cancel_url": "https://discord.com/channels/@me"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": product.name,
                    "sku": sku,
                    "price": product.price,
                    "currency": product.currency,
                    "quantity": 1
                }]
            },
            "amount": {
                "currency": product.currency,
                "total": product.price
            },
            "description": `Achat CODM Bot: ${product.name}`,
            "custom": `${userId}:${sku}` // Stocke UserId et SKU pour identification précise au Webhook
        }]
    };

    return new Promise((resolve, reject) => {
        paypal.payment.create(create_payment_json, function (error, payment) {
            if (error) {
                console.error('[PayPal Create] Error:', error);
                reject(error);
            } else {
                const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
                resolve({
                    paymentId: payment.id,
                    url: approvalUrl ? approvalUrl.href : null,
                    product: product
                });
            }
        });
    });
}

/**
 * Vérifie le statut d'un paiement via l'API PayPal (Polling)
 */
async function checkPaymentStatus(paymentId) {
    return new Promise((resolve, reject) => {
        paypal.payment.get(paymentId, function (error, payment) {
            if (error) {
                reject(error);
            } else {
                // Si le paiement est approuvé (l'utilisateur a payé sur le site PayPal)
                // Note: En mode 'sale', l'état passe à 'approved' avant l'exécution.
                // Mais pour finaliser, il faut faire payment.execute().
                // Cependant, sans return_url valide qui nous donne PayerID, l'exécution automatique est complexe.
                // ASTUCE : On demande juste si c'est 'approved' (l'utilisateur a validé).
                // Si on veut vraiment capturer l'argent, il faut le PayerID (qui est dans l'URL de retour).

                // Pour simplifier ce MVP "Sans Webhook", on va supposer que si l'état est 'approved' (ou 'created' mais PayPal update status), c'est bon?
                // Non, l'état reste 'created' tant que pas exécuté.
                // L'utilisateur DOIT être redirigé vers nous avec PayerID.
                // Si on ne peut pas recevoir la redirection, on ne peut pas récupérer le PayerID facilement.

                // Alternative "Sans Webhook" ET "Sans Serveur" :
                // C'est très difficile avec PayPal REST API standard car il faut le PayerID pour exécuter le paiement.
                // Solution : Utiliser PayPal Checkout (Client side) ? Non, on est sur Discord.

                // TENTATIVE : On va espérer que le SDK permette de voir si l'utilisateur a approuvé.
                // Si l'utilisateur a cliqué sur "Payer", l'état de la transaction côté PayPal change.

                resolve(payment.state); // 'created', 'approved', 'failed'
            }
        });
    });
}

/**
 * Attend que le paiement soit validé (Polling actif)
 * @param {string} paymentId 
 * @param {Function} onSuccess Callback quand payé
 */
async function waitForPayment(paymentId, userId, sku, onSuccess) {
    const MAX_ATTEMPTS = 60; // 5 minutes (si check toutes les 5s)
    let attempts = 0;

    const interval = setInterval(async () => {
        attempts++;
        try {
            // Note: Sans PayerID (return URL), on ne peut pas vérifier 'approved' facilement avec l'API REST v1.
            // Cependant, on va simuler ici pour le prototype ou utiliser une autre méthode si possible.
            // (En vraie prod sans serveur, on utilise souvent des services tiers comme Stripe Payment Links qui ont une API de vérification status plus simple).

            // Pour ce code, on va laisser la logique de checkPaymentStatus.
            // Si on ne peut pas vérifier, on devra demander à l'utilisateur de cliquer sur un bouton "J'ai payé" qui déclenche une vérification (si possible).

            // SIMULATION INTELLIGENTE :
            // Si c'est en Sandbox, on peut peut-être bypasser pour tester ?
            // Non, restons sérieux.

            // Si on ne peut pas avoir de serveur, PayPal est compliqué.
            // On va assumer que l'utilisateur veut ça.

            /* 
               REALITY CHECK:
               REST API v1 needs execution with PayerID.
               Without a web server to catch the return_url? PayerID is missing.
               
               WORKAROUND:
               User copies the PayerID from the success page? No.
               
               Maybe NOWPayments (Crypto) is easier for polling? Yes.
               
               For PayPal, we might be stuck without a callback URL.
               Let's implement the structure assuming we *can* check, or warn the user.
            */

        } catch (e) {
            console.error(e);
        }

        if (attempts >= MAX_ATTEMPTS) {
            clearInterval(interval);
        }
    }, 5000);
}

// Pour le moment, exportons les fonctions de base.
// On va simplifier : On ne peut PAS faire de PayPal sans serveur/webhook/return_url facilement.
// MAIS on peut faire du "Manuel assisté" -> L'utilisateur envoie une preuve ou on check manuellement.
// OU on utilise une API tierce qui gère ça.

// Je vais quand même inclure la livraison de produit.

/**
 * Traite le Webhook PayPal (Paiement validé)
 */
async function handlePayPalWebhook(req) {
    // Note: Sur Render, req.body contient déjà l'objet parsé grâce à body-parser
    const body = req.body;

    // Log pour debug
    console.log('[PayPal Webhook] Type:', body.event_type);

    if (body.event_type === 'PAYMENT.SALE.COMPLETED') {
        const resource = body.resource;
        const customField = resource.custom;

        if (!customField || !customField.includes(':')) {
            console.error('[PayPal Webhook] Invalid custom field format:', customField);
            return { success: false, error: 'Format custom invalide' };
        }

        const [userId, sku] = customField.split(':');
        console.log(`[PayPal Webhook] Payment confirmed for User: ${userId}, Product: ${sku}`);

        return await deliverProduct(userId, sku, resource.id);
    }

    return { success: true };
}

async function deliverProduct(userId, sku, paymentId = 'manual') {
    const product = PRODUCTS[sku];
    if (!product) return { success: false, error: 'Produit inconnu' };

    try {
        let message = '';

        if (product.type === 'consumable') {
            await Blackjack.updateBalance(userId, product.amount);
            message = `✅ **${product.name}** crédité ! (+${product.amount} 🪙)`;
        } else if (product.type === 'subscription') {
            await createSubscription(userId, product.tier, product.cycle || 'monthly');
            message = `💎 **${product.name}** activé avec succès !`;
        } else if (product.type === 'bundle') {
            await Blackjack.updateBalance(userId, product.amount);
            await createSubscription(userId, product.tier, 'monthly');
            message = `🎁 **${product.name}** activé ! (+${product.amount} 🪙 & Grade)`;
        }

        // Log transaction
        await db.collection('transactions').add({
            userId,
            sku,
            amount: product.price,
            currency: product.currency,
            provider: 'manual_admin', // En attendant l'auto
            timestamp: new Date()
        });

        return { success: true, message };
    } catch (error) {
        console.error('[DeliverProduct] Error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createPayPalPayment,
    handlePayPalWebhook,
    deliverProduct,
    PRODUCTS
};
