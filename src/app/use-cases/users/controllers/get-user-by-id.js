// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

// Importa a função para transformar os dados do usuário antes de enviá-los para o frontend
const userTransformer = require("../../../utils/user-transformer");

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o token foi enviado na requisição
    if (!id) {
      return res.status(400).json({ message: "O id e obrigatorio." });
    }

    const user = await User.findOne({ _id: id }).select(
      "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image"
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    } else {
      return res.status(200).json({
        user,
        message: "Usuario encontrado com sucesso.",
      });
    }
  } catch (err) {
    // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
    console.error("Erro ao buscar o usuario pelo ID:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = getUserById;
