const admin = require('firebase-admin');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ ERREUR : Il manque des variables Firebase sur Railway !');
    console.error('Vérifiez que FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY sont bien configurées.');
}

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
    // Handle cases where the key might be wrapped in quotes or have literal \n
    // and ensure it starts/ends with the correct PEM markers
    privateKey = privateKey.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');

    // Safety check: ensure the key has the correct headers
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
}

const serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: privateKey,
};

let db = null;

if (!admin.apps.length) {
    try {
        if (!serviceAccount.project_id || !serviceAccount.private_key) {
            throw new Error('Variables d\'environnement Firebase manquantes (PROJECT_ID ou PRIVATE_KEY)');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase initialisé avec succès !');
        db = admin.firestore();
    } catch (error) {
        console.error('❌ ERREUR CRITIQUE : Échec de l\'initialisation de Firebase.');
        console.error('Détails :', error.message);
        console.error('ASTUCE : Sur Render, assurez-vous que FIREBASE_PRIVATE_KEY est entourée de guillemets "" ou contient les \\n littéraux.');
    }
} else {
    db = admin.firestore();
}

module.exports = { db, admin };
