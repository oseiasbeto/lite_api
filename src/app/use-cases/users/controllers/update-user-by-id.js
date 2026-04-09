// controllers/user/updateUserById.js (versão simplificada)

const User = require("../../../models/User");

const CLOUD_NAME = 'daujoblcc';

/**
 * Extrai o caminho completo após /upload/ (incluindo folder)
 */
const extractFullPathAfterUpload = (url) => {
    if (!url) return null;
    const match = url.match(/\/upload\/(.+)$/);
    return match ? match[1] : null;
};

/**
 * Extrai o public_id completo (com folder) da URL
 */
const extractFullPublicId = (url) => {
    const fullPath = extractFullPathAfterUpload(url);
    if (!fullPath) return null;
    
    // Remove transformações se existirem
    const parts = fullPath.split('/');
    // Se a última parte contém extensão, pode ser o arquivo
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) {
        return lastPart.replace(/\.[^/.]+$/, '');
    }
    return fullPath.replace(/\.[^/.]+$/, '');
};

/**
 * Gera URL normal (sem círculo)
 */
const getNormalUrl = (originalUrl, width, height) => {
    const fullPath = extractFullPathAfterUpload(originalUrl);
    if (!fullPath) return originalUrl;
    
    const baseUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
    return `${baseUrl}/c_fill,w_${width},h_${height},q_auto,f_auto/${fullPath}`;
};

/**
 * Gera URL circular para push notification
 */
const getPushNotificationUrl = (originalUrl, size) => {
    const fullPath = extractFullPathAfterUpload(originalUrl);
    if (!fullPath) return originalUrl;
    
    const baseUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
    return `${baseUrl}/c_fill,g_auto,w_${size},h_${size},r_max,f_png,b_transparent/${fullPath}`;
};

/**
 * Gera todas as thumbnails
 */
const generateThumbnails = (originalUrl) => {
    if (!originalUrl) return null;
    
    return {
        // URLs normais (SEM círculo)
        xs: getNormalUrl(originalUrl, 50, 50),
        sm: getNormalUrl(originalUrl, 100, 100),
        md: getNormalUrl(originalUrl, 200, 200),
        lg: getNormalUrl(originalUrl, 400, 400),
        xl: getNormalUrl(originalUrl, 800, 800),
        
        // URLs para push notification (COM círculo)
        push_notification: getPushNotificationUrl(originalUrl, 250),
        push_notification_small: getPushNotificationUrl(originalUrl, 96),
        push_notification_large: getPushNotificationUrl(originalUrl, 512),
        push_notification_ios: getPushNotificationUrl(originalUrl, 256),
        push_notification_android: getPushNotificationUrl(originalUrl, 192)
    };
};

const updateUserById = async (req, res) => {
    try {
        const { id } = req.user;
        const { name, bio, location, picture, credentials, playerIdOneSignal, theme } = req.body;

        if (!id) {
            return res.status(400).json({ message: "O id é obrigatório." });
        }

        const user = await User.findById(id).select("-password -googleId -facebookId -createdAt -updatedAt -__v");

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Atualizar campos
        if (name?.trim()) user.name = name;
        if (bio !== undefined) user.bio = bio || "";
        if (location?.trim()) user.location = location;
        if (credentials?.trim()) user.credentials = credentials;
        if (playerIdOneSignal) user.player_id_onesignal = playerIdOneSignal;
        if (theme?.trim()) {
            if (!user.settings) user.settings = {};
            user.settings.theme = theme;
        }

        // Processar imagem
        if (picture !== undefined) {
            if (!picture || picture === "") {
                user.profile_image = {
                    public_id: null,
                    url: "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
                    thumbnails: null,
                    metadata: null
                };
            } else if (typeof picture === 'string' && picture.includes('cloudinary.com')) {
                const thumbnails = generateThumbnails(picture);
                const fullPublicId = extractFullPublicId(picture);
                
                user.profile_image = {
                    public_id: fullPublicId,
                    url: thumbnails?.lg || picture,
                    thumbnails: thumbnails,
                    metadata: { 
                        original_url: picture, 
                        uploaded_at: new Date() 
                    }
                };
            }
        }

        await user.save();

        return res.status(200).json({
            user: user.toObject(),
            message: "Usuário atualizado com sucesso.",
        });
        
    } catch (err) {
        console.error("Erro ao atualizar o usuário:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = updateUserById;