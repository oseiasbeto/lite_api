// controllers/auth/registerController.js
const bcrypt = require('bcryptjs');
const moment = require("moment");
const generateAccessToken = require("../../../utils/generate-access-token");
const generateRefreshToken = require("../../../utils/generate-refresh-token");
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token");
const Session = require("../../../models/Session");
const User = require('../../../models/User');

const completeRegistration = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validações básicas
    if (!password) {
      return res.status(400).json({ message: 'A senha e obrigatórios.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    .select(
      'username name is_verified password account_verification_status followers_count following_count last_seen is_online blocked_users gender posts_count subscribers coin_balance total_rewards_earned total_coins_converted following player_id_onesignal location settings following_count followers followers_count bio email website cover_photo profile_image unread_notifications_count unread_messages_count'
    )

    if (!user) {
      return res.status(400).json({ message: 'Sessao invalida. Verifique o seu e-mail primeiro.' });
    }

    // 3. Gera hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword

    await user.save();

    user.password = undefined
    
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

    // [TODO] cancele o temporizador que elimina a conta em 1h se nao finalizar o cadatro.

    // 7. Resposta de sucesso
    res.status(201).json({
      message: 'Conta criada com sucesso.',
      access_token: accessToken,
      session_id: session.id,
      user
    });

  } catch (error) {
    console.error('Erro ao completar o registo:', error);
    res.status(500).json({ message: 'Erro ao completar o registo.' });
  }
};

module.exports = completeRegistration;