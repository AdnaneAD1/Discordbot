const admin = require('firebase-admin');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ ERREUR : Il manque des variables Firebase sur Railway !');
    console.error('Vérifiez que FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY sont bien configurées.');
}

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
    // Handle cases where the key might be wrapped in quotes or have literal \n
    privateKey = privateKey.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
}

const serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: privateKey,
};

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase initialisé avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase :', error.message);
        // On continue pour ne pas faire crash tout le bot si possible, 
        // mais les fonctions DB échoueront plus tard.
    }
}

const db = admin.firestore();

module.exports = { db, admin };
