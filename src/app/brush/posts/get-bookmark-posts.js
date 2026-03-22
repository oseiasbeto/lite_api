const Post = require("../../models/Post");
const User = require("../../models/User");

const getBookmarkPosts = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const isLoad = (req.query.is_load && req.query.is_load === "true") || false;

    // Buscar informações do usuário logado para excluir posts próprios e bloqueados
    const currentUser = await User.findById(userId)
      .select("_id")
      .lean();
    if (!currentUser) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const filter = {
      $and: [
        { bookmarks: currentUser._id }
      ],
    };

    const posts = await Post.find(filter)
      .sort({ created_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate({
        path: "media",
        select: "url _id type format thumbnail duration post",
      })
      .populate(
        "author",
        "name verified is_online profile_image"
      ) // Popula username e profile_picture
      .populate({
        path: "shared_post",
        populate: [
          {
            path: "author",
            select: "name verified is_online profile_image",
          },
          {
            path: "media",
            select: "url type thumbnail format width height duration",
          }
        ]
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let total;

    if (!isLoad) {
      total = await Post.countDocuments({
        $and: [{ author: { $nin: currentUser.blocked_users || [] } }]
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
    console.error("Erro ao buscar os favoritos:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getBookmarkPosts;
