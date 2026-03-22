// controllers/auth/registerController.js
const crypto = require('crypto');
const moment = require("moment");
const User = require('../../../models/User');
const generateUsernameByEmail = require('../../../utils/generate-username-by-email');

const register = async (req, res) => {
  try {
    const { name, email } = req.body;

    // 1. Validações básicas
    if (!name || !email) {
      return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    // Gera código de verificação de 6 dígitos
    const verificationCode = crypto.randomInt(100000, 999999);
    const codeExpires = Date.now() + 15 * 60 * 1000; // 15 minutos


    // Verifica se e-mail já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      if (existingUser?.account_verification_status !== 'pending') {
        return res.status(400).json({ message: 'Este e-mail já está em uso.' });
      } else {
        const now = moment();
        const expiration_time = moment(existingUser.email_code_expires);

        if (now.isBefore(expiration_time)) {

          existingUser.email_code = Number(verificationCode)
          existingUser.email_code_expires = codeExpires

          if (existingUser.email_code_attempts < 5) {
            existingUser.email_code_attempts += 1
          }

          await existingUser.save()

          if (existingUser.email_code_attempts < 5) {
            /*
         Envia e-mail com código
        sendVerificationEmail({
          to: user.email,
          name: user.name,
          code: verificationCode
        }); 
        */
          }

          return res.status(200).send()
        } else return res.status(400).send({
          message: "Algo deu errado."
        })
      }
    } else {

      // 5. Cria usuário temporário (não verificado)
      const user = new User({
        name: name.trim(),
        username: generateUsernameByEmail(email),
        email: email.toLowerCase().trim(),
        email_code: Number(verificationCode),
        email_code_expires: codeExpires,
        email_code_attempts: 1,
      });

      await user.save();

      const appEnv = process.env?.NODE_ENV || 'dev'

      if (appEnv === 'prod') {
        /*
      // 6. Envia e-mail com código
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        code: verificationCode
      }); 
      */
      } else {
        console.log("OTP de registro de conta:", verificationCode)
      }


      // 7. Resposta de sucesso
      res.status(201).json({
        success: true,
        message: 'Verifique o OTP no seu e-mail para verificar a sua conta.',
        userId: user._id // opcional, para referência
      });
    }
  } catch (error) {
    console.error('Erro no register:', error);
    res.status(500).json({ message: 'Erro interno ao criar conta.' });
  }
};

module.exports = register;