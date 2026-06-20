const axios = require('axios');
require('dotenv').config();

const ONESIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONE_SIGNAL_APP_KEY;

// Validação básica
if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    throw new Error('⚠️ ONE_SIGNAL_APP_ID e ONE_SIGNAL_APP_KEY devem estar definidos no .env');
}

const sendPushNotification = async ({playerId, largeIcon, title, message, postId}) => {
    try {
        // === VALIDAÇÃO FORTE ===
        if (!message || typeof message !== 'string' || message.trim() === '') {
            throw new Error('Message is required and cannot be empty');
        }
        
        const notification = {
            app_id: ONESIGNAL_APP_ID,
            contents: { 
                en: message.trim() 
            },
            headings: { 
                en: (title && title.trim() !== '') ? title.trim() : "Nova notificação" 
            },
            include_player_ids: [playerId],   // ← Use o parâmetro que veio, não hard-coded
            // include_player_ids: ['beb594c5-f6bc-4dee-b5b8-04c7996656c3'], // só para teste
        };

        // Adiciona imagem só se existir
        if (largeIcon) {
            notification.large_icon = largeIcon;
            notification.ios_attachments = { "avatar": largeIcon };
        }

        const response = await axios({
            method: 'post',
            url: 'https://onesignal.com/api/v1/notifications',
            data: notification,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_API_KEY}`
            },
            timeout: 10000
        });

        console.log('✅ Notificação enviada com sucesso:', response.data);
        return response.data;

    } catch (error) {
        // ... seu tratamento de erro existente
        console.error('Erro completo:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = sendPushNotification;