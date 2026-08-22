// controllers/auth/authGoogle.js
const { OAuth2Client } = require('google-auth-library');
const moment = require('moment');

const User = require('../../../models/User'); // ajuste o caminho conforme sua estrutura
const Session = require('../../../models/Session');

const generateidToken = require('../../../utils/generate-access-token');
const generateRefreshToken = require('../../../utils/generate-refresh-token');
const encryptRefreshToken = require('../../../utils/encrypt-refresh-token');
const generateUniqueUsername = require('../../../utils/generate-unique-username');

// Client ID do Google Cloud Console (mesmo usado no frontend/app para gerar o idToken).
// Se você tem apps diferentes (web, iOS, Android) com client IDs diferentes,
// GOOGLE_CLIENT_IDS pode ser uma lista separada por vírgula no .env.
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const googleClient = new OAuth2Client();

const authGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    // 1. Validação básica do payload
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'idToken é obrigatório.'
      });
    }

    if (GOOGLE_CLIENT_IDS.length === 0) {
      console.error('GOOGLE_CLIENT_ID(S) não configurado no .env');
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor.'
      });
    }

    // 2. Verifica o idToken (JWT) DIRETO com o Google — valida assinatura,
    //    expiração, issuer e audience localmente, sem precisar de rede/API key.
    //    Nunca confie apenas nos dados que o client mandou no body sem essa checagem.
    let googleProfile;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_IDS
      });
      googleProfile = ticket.getPayload(); // { sub, email, email_verified, name, picture, ... }
    } catch (err) {
      console.error('Erro ao verificar idToken do Google:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Token do Google inválido ou expirado.'
      });
    }

    const userId = googleProfile.sub; // Google user ID

    const email = googleProfile.email ? googleProfile.email.toLowerCase().trim() : null;

    // 4. Busca usuário existente pelo google_id
    let user = await User.findOne({ google_id: userId });

    if (!user) {
      // 4a. Se não achou por google_id, tenta casar por e-mail
      //     (evita duplicar conta de quem já tinha cadastro por senha)
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        user.google_id = userId;
        user.account_verification_status = 'verified';
      } else {
        // 4b. Cria novo usuário
        const username = await generateUniqueUsername(googleProfile.name);

        user = new User({
          google_id: userId,
          email: email || undefined,
          username,
          name: googleProfile.name || '',
          account_verification_status: 'verified',
          ...(googleProfile.picture && {
            profile_image: { url: googleProfile.picture }
          })
        });
      }

      await user.save();
    }

    // 5. Conta desativada (soft delete)
    if (user?.is_deleted) {
      console.log('Conta desativada:', user._id);
      return res.status(400).json({
        success: false,
        message: 'Esta conta foi desativada.'
      });
    }

    // 6. 2FA (se ativado)
    if (user?.two_factor_enabled) {
      console.log('2FA necessária para usuário:', user._id);
      return res.status(200).json({
        success: true,
        requires_2fa: true,
        message: 'Autenticação de dois fatores necessária.',
        userId: user._id
      });
    }

    // 7. Login bem-sucedido → cria sessão e tokens (igual ao login normal)
    const newidToken = generateidToken(user, '30d');
    const refreshToken = generateRefreshToken(user, '1y');
    const encrypted = encryptRefreshToken(refreshToken);

    const session = new Session({
      user: user._id,
      token: encrypted.encrypted_refresh_token,
      crypto: { key: encrypted.key, iv: encrypted.iv },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      authentication_method: 'google',
      expires_at: moment().add(1, 'year').toDate()
    });

    await session.save();

    // Atualiza presença
    user.is_online = true;
    user.last_seen = new Date();
    await user.save();

    user.password = undefined;
    user.two_factor_secret = undefined;

    // 8. Resposta final (mesmo formato do login normal)
    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      access_token: newidToken,
      session_id: session.id.toString(),
      user
    });

  } catch (error) {
    console.error('Erro no login com Google:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
};

module.exports = authGoogle;