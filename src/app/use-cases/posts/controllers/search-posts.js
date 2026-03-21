const Post = require("../../../models/Post");
const User = require("../../../models/User");

/**
 * Busca posts por texto com paginação, excluindo posts do usuário logado e bloqueados, com ordenação por relevância ou recência.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const searchPosts = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado (obrigatório)
    const searchQuery = req.query.q || ""; // Termo de busca (padrão: vazio)
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Total de itens (para is_load)
    const isLoad = req.query.is_load === "true" || false; // Carregamento incremental
    const recentOnly = req.query.recent_only === "true" || false; // Ordenar apenas por recência

    // Verificar autenticação
    if (!userId) {
      return res.status(401).json({ message: "Autenticação necessária para busca de posts." });
    }

    // Buscar informações do usuário logado para excluir posts próprios e bloqueados
    const currentUser = await User.findById(userId)
      .select("blocked_users")
      .lean();
    if (!currentUser) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Construir filtro para posts
    const filter = {
      $and: [
        // Incluir apenas posts ou reposts
        { $or: [{ is_reply: false }, { is_repost: true }] },
        // Excluir posts do usuário logado
        { author: { $ne: userId } },
        // Excluir posts de usuários bloqueados
        { author: { $nin: currentUser.blocked_users || [] } },
        // Busca por texto no conteúdo (case-insensitive)
        searchQuery.trim() ? { content: { $regex: searchQuery, $options: "i" } } : {},
      ],
    };

    // Definir pipeline de agregação
    const pipeline = [
      { $match: filter },
      // Adicionar campos de relevância e interação (apenas se recentOnly=false)
      ...(recentOnly
        ? []
        : [
            {
              $addFields: {
                relevance_score: {
                  $add: [
                    { $multiply: ["$likes_count", 2] }, // +2 por curtida
                    { $multiply: ["$comments_count", 3] }, // +3 por repost
                  ],
                },
                is_liked: { $in: [userId, "$likes"] }, // Verifica se o usuário curtiu
              },
            },
          ]),
      // Ordenar
      {
        $sort: recentOnly
          ? { created_at: -1 } // Apenas por recência
          : { relevance_score: -1, created_at: -1 }, // Relevância com desempate por recência
      },
      { $skip: skip },
      { $limit: limit },
      // Juntar com informações do autor
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      // Juntar com mídias
      {
        $lookup: {
          from: "media",
          localField: "media",
          foreignField: "_id",
          as: "media",
        },
      },
      // Juntar com post original (para reposts)
      {
        $project: {
          _id: 1,
          content: 1,
          created_at: 1,
          is_reply: 1,
          is_repost: 1,
          likes_count: 1,
          dislikes_count: 1,
          comments_count: 1,
          likes: 1, 
          dislike: 1,
          media: {
            _id: 1,
            url: 1,
            type: 1,
            format: 1,
            thumbnail: 1,
            duration: 1,
            post: 1,
          },
          author: {
            _id: 1,
            username: 1,
            name: 1,
            verified: 1,
            activity_status: 1,
            blocked_users: 1,
            gender: 1,
            posts_count: 1,
            subscribers: 1,
            following: 1,
            following_count: 1,
            followers: 1,
            followers_count: 1,
            bio: 1,
            email: 1,
            website: 1,
            cover_photo: 1,
            profile_image: 1,
          },
        },
      },
    ];

    // Buscar posts com agregação
    const posts = await Post.aggregate(pipeline);

    // Contar total de resultados (se não for carregamento incremental)
    let total;
    if (!isLoad) {
      total = await Post.countDocuments(filter);
    } else {
      total = totalItems;
    }
    const totalPages = Math.ceil(total / limit);

    // Formatar resposta
    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar posts:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = searchPosts;