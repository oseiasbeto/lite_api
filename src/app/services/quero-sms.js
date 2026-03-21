const axios = require("axios");


// Função principal para envio de emails
async function sendMessage({to, message}) {
    try {
        const apiUrl = process.env.QSMS_APIURL
        const apiKey = process.env.QSMS_APIKEY
        const senderId = process.env.QSMS_SENDER_ID

        console.log(to)

        const response = await axios.post(apiUrl, {
            to,
            messaging_service_sid: senderId,
            message
        }, {
            headers: {
                'X-QueroSMS-API-Key': apiKey,
                "Content-Type": "application/json",
            },
        })
        if (response.data.success) {
            console.log('SMS enviado! ID:', response.data.data.sms_id);
        }
    } catch (err) {
        console.log("Erro ao enviar a SMS: ", err);
    }
}

module.exports = sendMessage