// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const Media = require("../../../models/Media");
const Post = require("../../../models/Post");

const getMediaByPostId = async (req, res) => {
  try {
    const id = req.params.post_id;

    // Verifica se o token foi enviado na requisição
    if (!id) {
      return res.status(400).json({ message: "O id e obrigatorio." });
    }
    const post = await Post.findOne({ _id: id }).select("_id");

    if (!post) {
      return res.status(404).json({ message: "Post nao encontrado" });
    } else {
      const media = await Media.find({ post: post?._id })
        .populate(
          "uploaded_by",
          "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image"
        ) // Popula username e profile_picture
        .populate({
          path: "post",
          populate: {
            path: "author",
            select:
              "username name verified activity_status blocked_users gender posts_count subscribers following followers bio email website cover_photo profile_image",
          },
        })
        .lean(); // Converte para objeto JavaScript puro
      return res.status(200).json({
        media,
        message: "Media encontrada com sucesso.",
      });
    }
  } catch (err) {
    // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
    console.error("Erro ao buscar a midia pelo id:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = getMediaByPostId;
