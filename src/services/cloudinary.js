/**
 * Service Cloudinary pour l'upload d'images
 */

const cloudinary = require('cloudinary').v2;

// Configuration via variables d'environnement
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload une image depuis une URL vers Cloudinary
 * @param {string} imageUrl - URL de l'image à uploader
 * @param {string} folder - Dossier de destination (ex: 'welcome_backgrounds')
 * @param {string} publicId - ID public optionnel
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadFromUrl(imageUrl, folder = 'bot_assets', publicId = null) {
    try {
        const options = {
            folder,
            resource_type: 'image',
            overwrite: true,
            transformation: [
                { width: 1200, height: 600, crop: 'fill', quality: 'auto' }
            ]
        };

        if (publicId) {
            options.public_id = publicId;
        }

        const result = await cloudinary.uploader.upload(imageUrl, options);

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('[Cloudinary] Erreur upload:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Supprime une image de Cloudinary
 * @param {string} publicId - ID public de l'image
 */
async function deleteImage(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId);
        return { success: true };
    } catch (error) {
        console.error('[Cloudinary] Erreur suppression:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Vérifie si Cloudinary est configuré
 */
function isConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

module.exports = {
    uploadFromUrl,
    deleteImage,
    isConfigured
};
