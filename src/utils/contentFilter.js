const bannedWords = [
    'nude', 'naked', 'nsfw', 'porn', 'sex', 'xxx', 'explicit',
    'gore', 'violence', 'blood', 'death', 'kill', 'murder',
    'racist', 'nazi', 'hate', 'offensive'
];

const criticalBannedWords = ['nude', 'naked', 'nsfw', 'porn', 'sex', 'xxx', 'explicit', 'nazi', 'racist'];

function normalizeText(text) {
    let normalized = text.toLowerCase();
    
    // Table de traduction Leetspeak
    const leetMap = {
        '4': 'a', '@': 'a',
        '3': 'e',
        '1': 'i', '!': 'i', '|': 'i',
        '0': 'o',
        '5': 's', '$': 's',
        '7': 't',
        '8': 'b',
        '9': 'g'
    };
    
    for (const [leet, normal] of Object.entries(leetMap)) {
        normalized = normalized.replaceAll(leet, normal);
    }
    
    // Supprimer tous les caractères non-alphanumériques (y compris les espaces)
    normalized = normalized.replace(/[^a-z0-9]/gi, '');
    
    return normalized;
}

function containsBannedContent(text) {
    const lowerText = text.toLowerCase();
    
    // 1. Détection par frontières de mots sur le texte original
    const wordBoundaryRegex = new RegExp(`\\b(${bannedWords.join('|')})\\b`, 'i');
    if (wordBoundaryRegex.test(lowerText)) {
        return true;
    }
    
    // 2. Détection sur le texte normalisé pour les mots critiques (contournements type p.o.r.n ou p0rn)
    const normalized = normalizeText(text);
    return criticalBannedWords.some(word => normalized.includes(word));
}

function validatePrompt(prompt) {
    if (!prompt || prompt.trim().length === 0) {
        return { valid: false, error: '❌ Le prompt ne peut pas être vide.' };
    }

    if (prompt.length > 500) {
        return { valid: false, error: '❌ Le prompt est trop long (max 500 caractères).' };
    }

    if (containsBannedContent(prompt)) {
        return { valid: false, error: '❌ Votre prompt contient du contenu inapproprié.' };
    }

    return { valid: true };
}

module.exports = { validatePrompt, containsBannedContent };
