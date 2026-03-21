const axios = require('axios');

// Substitua pelos valores do seu OneSignal
const ONE_SIGNAL_API_URL = process.env.ONE_SIGNAL_API_URL
const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID
const ONE_SIGNAL_API_KEY = process.env.ONE_SIGNAL_API_KEY

async function sendPushNotification({playerId, title, message}) {
    try {
        const response = await axios.post(ONE_SIGNAL_API_URL
            ,
            {
                app_id: ONE_SIGNAL_APP_ID,
                include_player_ids: [playerId], // envia para usuário específico
                headings: { en: title },
                contents: { en: message },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
                },
            }
        );
        console.log('Notification sent:', response.data);
    } catch (error) {
        console.error('Error sending notification:', error.response?.data || error.message);
    }
}

module.exports = sendPushNotification