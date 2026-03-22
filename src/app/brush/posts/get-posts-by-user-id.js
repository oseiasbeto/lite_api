const Post = require("../../models/Post");

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getPostsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const isLoad = req?.query?.is_load === "true" || false;

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const posts = await Post.find({
      author: userId,
      is_repost: false,
      is_reply: false,
    })
      .sort({ created_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate(
        "author",
        "name verified is_online profile_image"
      )
      .populate({
        path: "media",
        select: "url _id type format thumbnail duration post",
      })
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
          },
        ],
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let total;

    if (!isLoad) {
      total = await Post.countDocuments({
        author: userId,
        is_repost: false,
        is_reply: false,
      });
    } else {
      total = totalItems;
    }
    const totalPages = Math.ceil(total / limit);

    // Formata a resposta
    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages, // Indica se há mais páginas
    });
  } catch (err) {
    console.error("Erro ao buscar postagem:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getPostsByUserId;
