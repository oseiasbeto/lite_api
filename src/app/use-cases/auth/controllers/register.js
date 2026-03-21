// controllers/auth/registerController.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../../models/User');
const generateUsernameByEmail = require('../../../utils/generate-username-by-email'); 

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validações básicas
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }

    // 2. Verifica se e-mail já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Este e-mail já está cadastrado.' });
    }

    // 3. Gera hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Gera código de verificação de 6 dígitos
    const verificationCode = crypto.randomInt(100000, 999999);
    const codeExpires = Date.now() + 15 * 60 * 1000; // 15 minutos

    // 5. Cria usuário temporário (não verificado)
    const user = new User({
      name: name.trim(),
      username: generateUsernameByEmail(email),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      email_code: Number(verificationCode),
      email_code_expires: codeExpires,
      email_code_attempts: 1,
    });

    await user.save();

    /*
    // 6. Envia e-mail com código
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code: verificationCode
    }); 
    */

    // 7. Resposta de sucesso
    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso. Verifique seu e-mail para confirmar.',
      userId: user._id // opcional, para referência
    });

  } catch (error) {
    console.error('Erro no register:', error);
    res.status(500).json({ message: 'Erro interno ao criar conta.' });
  }
};

module.exports = register;