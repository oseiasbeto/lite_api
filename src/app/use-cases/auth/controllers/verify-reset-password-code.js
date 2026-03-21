// controllers/auth/verifyEmail.js
const User = require("../../../models/User");
const moment = require("moment");

const verifyResetPasswordCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email })

    if (!user) return res.status(400).json({ message: "Usuario não encontrado" });

    const now = moment();
    const expiration_time = moment(user.reset_password_expires);
 
    if (user.reset_password_code !== Number(code) || now.isAfter(expiration_time)) {
      return res.status(400).json({ message: "Código inválido ou expirado" });
    }

    // Limpa código e ativa conta
    user.reset_password_expires = undefined;
    user.reset_password_attempts = undefined;

    await user.save();

    return res.status(200).json({
      message: "Tudo certo.",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Erro interno" });
  }
};

module.exports = verifyResetPasswordCode;