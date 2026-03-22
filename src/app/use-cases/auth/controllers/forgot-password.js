const User = require('../../../models/User'); 
const moment = require('moment'); 
const crypto = require('crypto');
//const sendMail = require('../../../mail/sendMail');

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body; // Obtém o e-mail do corpo da requisição

        if (!email) {
            return res.status(400).json({ message: "O e-mail é obrigatório." }); 
        }

        const user = await User.findOne({ email, account_verification_status: 'verified' }); 

        if (!user) {
            return res.status(400).json({ message: "Usuário não encontrado." }); // Retorna erro se o usuário não for encontrado
        }

        // Verifica se já existe um token ativo para redefinição de senha
        if (user.reset_password_code && user.reset_password_expires) {
            const now = moment(); // Obtém o momento atual

            const expirationTime = moment(user.reset_password_expires); // Obtém a data de expiração do token

            if (now.isBefore(expirationTime)) {
                return res.status(200).json();
            }
        }

        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const codeExpires = Date.now() + 15 * 60 * 1000; // 15 minutos

        user.reset_password_code = verificationCode; 
        user.reset_password_expires = codeExpires
        user.reset_password_attempts += 1

        await user.save(); 

        // Aqui você pode adicionar o envio do e-mail com o token

        /* 
        const title = "Redefinição de senha";
        const message = "Clique no link abaixo para redefinir sua senha na 1kole:";
        const resetLink = `${process.env.CLIENT_URL}reset_password?token=${token}`;

        await sendMail(user.email, "reset_password", title, { resetLink: resetLink, title, message });
        */

        return res.status(200).json({ message: "Um link de redefinição de senha foi enviado para o seu e-mail." }); // Retorna sucesso
    } catch (error) {
        console.log("Erro ao recuperar a senha: "+error.message)
        return res.status(500).json({ message: "Erro ao recuperar a senha" });
    }
};

module.exports = forgotPassword; // Exporta a função para uso em outras partes do código
