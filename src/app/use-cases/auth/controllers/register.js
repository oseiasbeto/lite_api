// controllers/auth/registerController.js
const crypto = require('crypto');
const moment = require("moment");
const User = require('../../../models/User');
const generateUsernameByEmail = require('../../../utils/generate-username-by-email');
const sendMail = require("../../../mail/send-mail");

const register = async (req, res) => {
  try {
    const { name, email } = req.body;

    // 1. Validações básicas
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome e e-mail são obrigatórios.' 
      });
    }

    // Gera código de verificação de 6 dígitos
    const verificationCode = crypto.randomInt(100000, 999999);
    const codeExpires = Date.now() + 15 * 60 * 1000; // 15 minutos

    // Verifica se e-mail já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      // Se o usuário já está verificado (conta ativa)
      if (existingUser.account_verification_status !== 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Este e-mail já está em uso e a conta já foi verificada.' 
        });
      }

      // Caso pendente: verifica se o código anterior ainda é válido
      const now = moment();
      const expiration_time = moment(existingUser.email_code_expires);

      if (now.isBefore(expiration_time)) {
        // Código anterior ainda ativo → apenas reenvia o MESMO código
        // (ou gera um novo? Para segurança, é melhor reenviar o mesmo código)
        // Vou manter a geração de um novo código, mas sem incrementar tentativas
        existingUser.email_code = Number(verificationCode);
        existingUser.email_code_expires = codeExpires;
        // NÃO incrementa email_code_attempts – esse campo é só para validação do OTP
        await existingUser.save();

        // Envia e-mail com o novo código
        const title = 'Verifique seu e-mail';
        const message = `Olá ${existingUser.name}, use o código abaixo para verificar sua conta no 1kole.`;
        await sendMail(existingUser.email, "confirmation_code", title, { 
          code: verificationCode, 
          title, 
          message 
        });

        return res.status(200).json({
          success: true,
          message: 'Novo código de verificação enviado para o e-mail.',
          userId: existingUser._id
        });
      } else {
        // Código expirado – podemos permitir reenvio com novo código
        existingUser.email_code = Number(verificationCode);
        existingUser.email_code_expires = codeExpires;
        existingUser.email_code_attempts = 0; // reseta tentativas
        await existingUser.save();

        const title = 'Verifique seu e-mail';
        const message = `Olá ${existingUser.name}, seu código expirou. Use o novo código abaixo.`;
        await sendMail(existingUser.email, "confirmation_code", title, { 
          code: verificationCode, 
          title, 
          message 
        });

        return res.status(200).json({
          success: true,
          message: 'Código expirado. Novo código enviado para o e-mail.',
          userId: existingUser._id
        });
      }
    }

    // ---------- Criação de novo usuário (não existe) ----------
    const user = new User({
      name: name.trim(),
      username: generateUsernameByEmail(email),
      email: email.toLowerCase().trim(),
      email_code: Number(verificationCode),
      email_code_expires: codeExpires,
      email_code_attempts: 0,  // ainda não tentou validar
    });

    await user.save();

    const appEnv = process.env.NODE_ENV || 'dev';

    if (appEnv === 'prod') {
      const title = 'Verifique seu e-mail';
      const message = `Olá ${user.name}, use o código abaixo para verificar sua conta no 1kole.`;
      await sendMail(user.email, "confirmation_code", title, { 
        code: verificationCode, 
        title, 
        message 
      });
    } else {
      // Em desenvolvimento, loga o código sem expô-lo em produção
      console.log(`[DEV] OTP para ${user.email}: ${verificationCode}`);
    }

    return res.status(201).json({
      success: true,
      message: 'Verifique o código enviado para o seu e-mail.',
      userId: user._id
    });

  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao criar conta. Tente novamente mais tarde.' 
    });
  }
};

module.exports = register;