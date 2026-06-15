// controllers/auth/verifyEmail.js
const User = require("../../../models/User");
const moment = require("moment");

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: "E-mail e código são obrigatórios." 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "Usuário não encontrado." 
      });
    }

    // Se já está verificado, não precisa repetir
    if (user.account_verification_status === 'verified') {
      return res.status(400).json({ 
        success: false, 
        message: "Conta já verificada. Faça login." 
      });
    }

    const now = moment();
    const expiration = moment(user.email_code_expires);

    const codeMatches = user.email_code === Number(code);
    const isExpired = now.isAfter(expiration);

    if (!codeMatches || isExpired) {
      let errorMsg = "Código inválido ou expirado.";
      if (isExpired) errorMsg = "Código expirado. Solicite um novo.";
      if (!codeMatches && !isExpired) errorMsg = "Código incorreto. Tente novamente.";

      // Opcional: incrementar tentativas falhas (para bloqueio futuro)
      // user.email_code_attempts = (user.email_code_attempts || 0) + 1;
      // await user.save();

      return res.status(400).json({ 
        success: false, 
        message: errorMsg,
        codeExpired: isExpired
      });
    }

    // Sucesso: limpa os campos de código e ativa a conta
    user.email_code = undefined;
    user.email_code_attempts = undefined;
    user.email_code_expires = undefined;
    user.account_verification_status = "verified";
    user.is_online = true;
    user.last_seen = new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      message: "E-mail verificado com sucesso!"
    });

  } catch (err) {
    console.error("Erro no verifyEmail:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Erro interno ao verificar código." 
    });
  }
};

module.exports = verifyEmail;