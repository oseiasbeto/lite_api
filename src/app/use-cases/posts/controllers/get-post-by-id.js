// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const Post = require("../../../models/Post");

const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o token foi enviado na requisição
    if (!id) {
      return res.status(400).json({ message: "O id e obrigatorio." });
    }

    const post = await Post.findOne({ _id: id })
      .populate(
        "author",
        "name verified is_online profile_image"
      ) // Popula username e profile_picture
      .populate({
        path: "shared_post",
        populate: [
          {
            path: "author",
            select:
              "name verified is_online profile_image",
          },
          {
            path: "media",
            select: "url _id type format thumbnail duration post",
          }
        ],
      })
      .populate({
        path: "media",
        select: "url _id type format thumbnail duration post",
      })
      .lean(); // Converte para objeto JavaScript puro

    if (!post) {
      return res.status(404).json({ message: "Post nao encontrado" });
    } else {
      return res.status(200).json({
        post,
        message: "Postagem encontrada com sucesso.",
      });
    }
  } catch (err) {
    // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
    console.error("Erro ao buscar a postagem pelo id:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = getPostById;
