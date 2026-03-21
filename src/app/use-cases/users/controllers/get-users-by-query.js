const User = require("../../../models/User");

const getUsersByQuery = async (req, res) => {
  try {
    // Extrair parâmetros da query
    const searchQuery = req.query.q || ""; // Termo de busca (username ou name)
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Itens por página (padrão: 10)
    const skip = (page - 1) * limit;
    const totalItems = parseInt(req.query.total) || 0; // Total de itens para otimização
    const isLoad = req?.query.is_load === "true" || false; // Indicador de carregamento incremental
    const userId = req?.user?.id; // ID do usuário autenticado (para filtrar bloqueados)

    // Construir o filtro de busca
    const filter = {
      $and: [
        // Filtra usuários com perfil público ou amigos (se autenticado)
        {
          $or: [
            { "privacy_settings.profile_visibility": "public" },
            userId
              ? {
                  "privacy_settings.profile_visibility": "followers",
                  followers: userId,
                }
              : { _id: null }, // Exclui friends_only se não autenticado
          ],
        },
        // Exclui usuários bloqueados pelo solicitante (se autenticado)
        userId ? { _id: { $nin: await User.findById(userId).select("blocked_users").lean().then(u => u.blocked_users || []) } } : {},
        // Exclui usuários com status de conta bloqueada ou rejeitada
        { account_verification_status: { $nin: ["locked", "rejected"] } },
      ],
    };

    // Adicionar critério de busca por username ou name (case-insensitive)
    if (searchQuery.trim()) {
      filter.$or = [
        { username: { $regex: searchQuery, $options: "i" } },
        { name: { $regex: searchQuery, $options: "i" } },
      ];
    }

    // Buscar usuários
    const users = await User.find(filter)
      .select(
        "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image"
      )
      .sort({
        verified: -1, // Usuários verificados aparecem primeiro
        followers_count: -1, // Depois, por número de seguidores (descendente)
        created_at: -1, // Por último, mais recentes
      })
      .skip(skip)
      .limit(limit)
      .lean();

    // Contar total de resultados (se não for carregamento incremental)
    let total;

    // Se não for carregamento incremental, contar total de usuários
    if (!isLoad) {
      total = await User.countDocuments(filter);
    } else {
      total = totalItems;
    }

    const totalPages = Math.ceil(total / limit);

    // Retornar resposta
    res.status(200).json({
      users,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getUsersByQuery;