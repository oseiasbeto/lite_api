const Post = require("../../models/Post");
const User = require("../../models/User");

/**
 * Busca posts de usuários que o usuário logado segue (feed "Seguindo").
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getFollowingPosts = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const isLoad = req?.query?.is_load === "true" || false;

    // 1. Busca a lista de IDs de usuários que o usuário logado segue
    const currentUser = await User.findById(userId).select("following");
    const followingIds = currentUser.following; // Array de IDs

    // 2. Busca posts APENAS dos usuários seguidos (com paginação)
    const posts = await Post.find({
      author: { $in: followingIds }, // Filtra por autores seguidos
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
          }
        ],
      })
      .lean();

    // 3. Conta o total de posts para paginação
    let total;

    if (!isLoad) {
      total = await Post.countDocuments({
        author: { $in: followingIds }, // Filtra por autores seguidos
        $or: [{ is_reply: false }, { is_repost: true }], // Exclui replies (ou não, conforme sua regra)
      });
    } else {
      total = totalItems;
    }
    const totalPages = Math.ceil(total / limit);

    // 4. Retorna a resposta formatada
    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar posts de usuários seguidos:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getFollowingPosts;
