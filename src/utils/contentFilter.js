const bannedWords = [
    'nude', 'naked', 'nsfw', 'porn', 'sex', 'xxx', 'explicit',
    'gore', 'violence', 'blood', 'death', 'kill', 'murder',
    'racist', 'nazi', 'hate', 'offensive'
];

function containsBannedContent(text) {
    const lowerText = text.toLowerCase();
    return bannedWords.some(word => lowerText.includes(word));
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
