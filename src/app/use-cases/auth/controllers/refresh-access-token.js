// Importa o modelo de Usuário para interagir com os dados dos usuários no banco de dados
const User = require("../../../models/User");

// Importa funções utilitárias para geração e manipulação de tokens JWT
const generateAccessToken = require("../../../utils/generate-access-token"); // Gera um novo token de acesso
const generateRefreshToken = require("../../../utils/generate-refresh-token"); // Gera um novo refresh token
const decryptRefreshToken = require("../../../utils/decrypt-refresh-token"); // Descriptografa um refresh token armazenado
const decodeTokem = require("../../../utils/decode-tokem"); // Decodifica um token JWT
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token"); // Criptografa um refresh token antes de armazená-lo
const userTransformer = require("../../../utils/user-transformer"); // Transforma os dados do usuário antes de enviá-los ao cliente

// Importa moment para manipulação de datas e horários
const moment = require("moment");

// Importa o modelo de Sessão para gerenciar sessões de usuários
const Session = require("../../../models/Session");

const { getIO } = require("../../../services/socket");

// Função responsável por atualizar o token de acesso com base em um refresh token válido
const refreshAccessToken = async (req, res) => {
  try {
    // Obtém o ID da sessão do corpo da requisição
    const { session_id } = req.body;

    // Verifica se o session_id foi informado corretamente
    if (!session_id) {
      return res.status(400).send({
        message: "Informe o ID da sessão.",
      });
    }

    // Busca a sessão ativa correspondente ao session_id informado
    const session = await Session.findOne({
      id: session_id,
      status: "active", // A sessão precisa estar ativa
    });

    // Se a sessão não for encontrada, retorna erro 401 (não autorizado)
    if (!session) {
      return res.status(401).send({
        message: "Ups! Não encontramos nenhuma sessão com este ID.",
      });
    }

    // Obtém os dados de criptografia da sessão
    const { key, iv } = session.crypto;

    // Obtém o refresh token criptografado armazenado na sessão
    const encryptedRefreshToken = session.token;

    // Obtém a chave secreta do refresh token a partir das variáveis de ambiente
    const secretRefreshTokenKey = process.env.JWT_REFRESH_TOKEN_SECRET;

    // Descriptografa o refresh token armazenado na sessão
    const decryptedToken = decryptRefreshToken({
      key,
      iv,
      encryptedRefreshToken,
    });

    // Decodifica os dados contidos no refresh token
    const decodedData = decodeTokem(decryptedToken, secretRefreshTokenKey);

    // Verifica se o token foi decodificado corretamente
    // Se for inválido ou inexistente, retorna erro 401 (não autorizado)
    if (!decodedData)
      return res.status(401).send({
        message: "Token inválido",
      });

    // Busca o usuário associado ao ID contido no refresh token
    const user = await User.findById(decodedData.id).select(
      "username name is_verified account_verification_status followers_count following_count coin_balance total_rewards_earned total_coins_converted is_online blocked_users gender posts_count subscribers following player_id_onesignal location settings following_count followers followers_count bio email website cover_photo profile_image unread_notifications_count unread_messages_count"
    );

    // Se o usuário não for encontrado, retorna erro
    if (!user) {
      return res.status(401).send({
        message: "Algo deu errado, faça login e tente novamente.",
      });
    }

    // Define os tempos de expiração dos tokens com valores padrão
    const expiresAccessToken = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "10m";
    const expiresRefreshToken =
      process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "1y";

    // Gera um novo token de acesso e um novo refresh token
    const accessToken = generateAccessToken(user, expiresAccessToken);
    const refreshToken = generateRefreshToken(user, expiresRefreshToken);

    // Criptografa o novo refresh token antes de armazená-lo
    const encryptedNewRefreshToken = encryptRefreshToken(refreshToken);

    // Atualiza a sessão no banco de dados com o novo refresh token e informações do usuário
    await session.updateOne({
      $set: {
        ipAddress: req.ip, // Atualiza o endereço IP do usuário
        userAgent: req.headers["user-agent"] || "Unknown", // Atualiza o agente do usuário (navegador/dispositivo)
        crypto: {
          key: encryptedNewRefreshToken.key, // Armazena a nova chave de criptografia
          iv: encryptedNewRefreshToken.iv, // Armazena o novo vetor de inicialização
        },
        token: encryptedNewRefreshToken.encrypted_refresh_token, // Armazena o novo refresh token criptografado
        lastAccessed: moment().toDate(), // Atualiza a última data de acesso
      },
    });

    // Atualiza o is_online como se fosse uma reconexão
    user.is_active = true;
    user.last_seen = moment();

    const io = getIO()

    if(io) {
      io.emit("join_conversations")
    }
    
    // Responde com o novo token de acesso e os dados do usuário transformados
    res.status(200).send({
      access_token: accessToken,
      session_id: session.id,
      user, // Formata os dados do usuário antes de enviar
      message: "Token de acesso atualizado com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao atualizar token de acesso:", err.message);

    // Caso ocorra um erro interno, retorna status 500 com a mensagem de erro
    res.status(500).send({
      message: "Erro interno do servidor.",
    });
  }
};

// Exporta a função para ser utilizada em outras partes do sistema
module.exports = refreshAccessToken;
