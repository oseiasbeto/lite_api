// controllers/auth/verifyEmail.js
const User = require("../../../models/User");
const generateAccessToken = require("../../../utils/generate-access-token");
const generateRefreshToken = require("../../../utils/generate-refresh-token");
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token");
const Session = require("../../../models/Session");
const moment = require("moment");

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email })
      .select("username name is_verified account_verification_status coin_balance total_rewards_earned total_coins_converted last_seen is_online followers_count following_count blocked_users gender posts_count subscribers following player_id_onesignal location settings following_count followers followers_count bio email email_code email_code_expires email_code_attempts website cover_photo profile_image unread_notifications_count unread_messages_count");

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

    // Gera tokens
    const accessToken = generateAccessToken(user, "30d");
    const refreshToken = generateRefreshToken(user, "1y");
    const encrypted = encryptRefreshToken(refreshToken);

    const session = new Session({
      user: user._id,
      token: encrypted.encrypted_refresh_token,
      crypto: { key: encrypted.key, iv: encrypted.iv },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      authentication_method: "email",
      expires_at: moment().add(1, "year").toDate()
    });

    await session.save();

    return res.status(200).json({
      message: "Login realizado com sucesso",
      access_token: accessToken,
      session_id: session.id,
      user
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Erro interno" });
  }
};

module.exports = verifyEmail;