// controllers/auth/loginController.js
const bcrypt = require('bcryptjs');
const User = require('../../../models/User'); // ajuste o caminho
const Session = require('../../../models/Session');
const moment = require('moment');

const generateAccessToken = require('../../../utils/generate-access-token');
const generateRefreshToken = require('../../../utils/generate-refresh-token');
const encryptRefreshToken = require('../../../utils/encrypt-refresh-token');

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // 1. Validação básica
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/nome de usuário e senha são obrigatórios.'
      });
    }

    // 2. Busca usuário por email ou username (case insensitive)
    const cleaned = identifier.trim().toLowerCase().replace(/^@/, ''); // remove @ se existir

    const user = await User.findOne({
      $or: [
        { email: cleaned },
        { username: cleaned }
      ]
    }).select(
      'username name is_verified password account_verification_status followers_count following_count last_seen is_online blocked_users gender posts_count subscribers coin_balance total_rewards_earned total_coins_converted following player_id_onesignal location settings following_count followers followers_count bio email website cover_photo profile_image unread_notifications_count unread_messages_count'
    );

  
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais inválidas.'
      });
    }

    // 3. Conta deletada/soft-deleted
    if (user?.is_deleted) {
      return res.status(400).json({
        success: false,
        message: 'Esta conta foi desativada.'
      });
    }

    // 4. Caso especial: usuário só tem login por telefone (sem senha cadastrada)
    if (!user.password && user.phone_number && user.account_verification_status === 'verified') {
      return res.status(200).json({
        success: true,
        requires_phone_code: true,
        message: 'Autenticação por código SMS necessária.',
        phone_number: user.phone_number // frontend pode mascarar e mostrar "****-****"
      });
    }

    // 5. Verifica senha (se existir)
    const isMatch = await bcrypt.compare(password, user.password || '');

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais inválidas.'
      });
    }

    // 6. Verifica 2FA (se ativado no futuro)
    if (user?.two_factor_enabled) {
      return res.status(200).json({
        success: true,
        requires_2fa: true,
        message: 'Autenticação de dois fatores necessária.',
        userId: user._id
      });
    }

    // 7. Login bem-sucedido → cria sessão e tokens
    const accessToken = generateAccessToken(user, '30d');
    const refreshToken = generateRefreshToken(user, '1y');
    const encrypted = encryptRefreshToken(refreshToken);

    const session = new Session({
      user: user._id,
      token: encrypted.encrypted_refresh_token,
      crypto: { key: encrypted.key, iv: encrypted.iv },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      authentication_method: 'password', // ou 'email' se quiser diferenciar
      expires_at: moment().add(1, 'year').toDate()
    });

    await session.save();

    // Atualiza presença
    user.is_online = true;
    user.last_seen = new Date();
    await user.save();


    user.password = undefined

    // 9. Resposta final
    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      access_token: accessToken,
      session_id: session.id.toString(),
      user
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
};

module.exports = login;