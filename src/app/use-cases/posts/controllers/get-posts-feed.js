const Post = require("../../../models/Post");

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getPostsFeed = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const hasTotal = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)

    const filters = {
      type: {
        $ne: "question"
      }
    }

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const posts = await Post.find(filters)
      .sort({ created_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate({
        path: "media",
        select: "url _id type width height format thumbnail duration post",
      })
      .populate(
        "author",
        "name verified is_online followers profile_image credentials location"
      ) // Popula username e profile_picture
      .populate({
        path: "shared_post",
        populate: [
          {
            path: "author",
            select:
              "name verified is_online followers profile_image credentials location",
          },
          {
            path: "media",
            select: "url _id type width height format thumbnail duration post",
          },
        ],
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let total;

    if (!hasTotal) {
      total = await Post.countDocuments(filters);
    } else {
      total = hasTotal;
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

module.exports = getPostsFeed;
