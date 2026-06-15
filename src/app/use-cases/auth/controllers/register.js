// controllers/auth/registerController.js
const crypto = require('crypto');
const moment = require("moment");
const User = require('../../../models/User');
const generateUsernameByEmail = require('../../../utils/generate-username-by-email');
const sendMail = require("../../../mail/send-mail");

const register = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome e e-mail são obrigatórios.' 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    // Caso 1: Usuário já existe e está verificado
    if (existingUser && existingUser.account_verification_status === 'verified') {
      return res.status(400).json({ 
        success: false, 
        message: 'Este e-mail já está em uso e a conta já foi verificada.' 
      });
    }

    // Gera um novo código (caso precise)
    const generateNewCode = () => crypto.randomInt(100000, 999999);
    const codeExpires = () => Date.now() + 15 * 60 * 1000;

    // Caso 2: Usuário pendente (existe mas não verificado)
    if (existingUser && existingUser.account_verification_status === 'pending') {
      const now = moment();
      const expiration = moment(existingUser.email_code_expires);

      if (now.isBefore(expiration)) {
        //  Código ainda válido → reenvia o MESMO código (sem gerar novo)
        const currentCode = existingUser.email_code;
        const title = 'Verifique seu e-mail';
        const message = `Olá ${existingUser.name}, reutilize o código abaixo para verificar sua conta no 1kole.`;

        await sendMail(existingUser.email, "confirmation_code", title, { 
          code: currentCode, 
          title, 
          message 
        });

        return res.status(200).json({
          success: true,
          message: 'Código reenviado (o mesmo anterior ainda é válido).',
          userId: existingUser._id
        });
      } else {
        // Código expirado → gera novo código, reseta tentativas e envia
        const newCode = generateNewCode();
        existingUser.email_code = Number(newCode);
        existingUser.email_code_expires = codeExpires();
        existingUser.email_code_attempts = 0; // reset
        await existingUser.save();

        const title = 'Verifique seu e-mail';
        const message = `Olá ${existingUser.name}, seu código expirou. Use o novo código abaixo.`;
        await sendMail(existingUser.email, "confirmation_code", title, { 
          code: newCode, 
          title, 
          message 
        });

        return res.status(200).json({
          success: true,
          message: 'Código expirado. Novo código enviado.',
          userId: existingUser._id
        });
      }
    }

    // Caso 3: Novo usuário (não existe)
    const verificationCode = generateNewCode();
    const user = new User({
      name: name.trim(),
      username: generateUsernameByEmail(normalizedEmail),
      email: normalizedEmail,
      email_code: Number(verificationCode),
      email_code_expires: codeExpires(),
      email_code_attempts: 0,
      account_verification_status: 'pending' // explícito
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