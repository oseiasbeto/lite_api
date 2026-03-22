// controllers/auth/verifyEmail.js
const User = require("../../../models/User");
const moment = require("moment");

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email })

    if (!user) return res.status(400).json({ message: "Usuario não encontrado" });

    const now = moment();
    const expiration_time = moment(user.email_code_expires);

    if (user.email_code !== Number(code) || now.isAfter(expiration_time)) {
      return res.status(400).json({ message: "Código inválido ou expirado" });
    }

    // Limpa código e ativa conta
    user.email_code = undefined;
    user.email_code_attempts = undefined;
    user.email_code_expires = undefined;

    user.account_verification_status = "verified";
    user.is_online = true;
    user.last_seen = new Date();

    await user.save();

    // [TODO] Coloque um temporizador para verificar se em ate 1h ele nao completar o registro entao elimine a conta.

    return res.status(200).json();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Erro interno" });
  }
};

module.exports = verifyEmail;