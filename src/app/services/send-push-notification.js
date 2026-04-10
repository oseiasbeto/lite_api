const OneSignal = require('@onesignal/node-onesignal');
require('dotenv').config();

const ONESIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONE_SIGNAL_APP_KEY;

const configuration = OneSignal.createConfiguration({
    authMethods: {
        app_key: {
            tokenProvider: {
                getToken: () => ONESIGNAL_API_KEY
            }
        }
    }
});
const client = new OneSignal.DefaultApi(configuration);

const sendPushNotification = async (playerId, largeIcon, title, message, postId) => {

    // 2. Monta o objeto de notificação com a imagem dinâmica
    const notification = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: `${title}` },
        contents: { en: `${message}` },
        include_player_ids: [playerId],
        ...(largeIcon && {
            large_icon: largeIcon,
            ios_attachments: {
                "avatar": largeIcon
            }
        })
    };

    try {
        const response = await client.createNotification(notification);
        console.log(`✅ Notificação enviada para ${playerId}`);
        return response;
    } catch (error) {
        console.error("❌ Erro ao enviar notificação:", error);
        throw error;
    }
}

module.exports = sendPushNotification;

// Função simulada para obter a URL do avatar do usuário