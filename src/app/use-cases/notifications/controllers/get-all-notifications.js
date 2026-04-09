const Notifications = require("../../../models/Notification");

const getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const notifications = await Notifications.find({
      recipient: userId,
    })
      .sort({ updated_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate(
        "sender",
        "name username verified is_online profile_image"
      ) 
      .populate(
        "recipient",
        "name username verified is_online profile_image"
      ) 
      .populate({
        path: "post",
        populate: [
          {
            path: "author", // Popula follower e followed dentro de Relationship
            select: "name username verified is_online profile_image",
          },
          {
            path: "media",
            select: "url _id type format thumbnail duration post",
          },
          {
            path: "shared_post",
            populate: [
              {
                path: "author",
                select: "name username verified is_online profile_image",
              },
              {
                path: "media",
                select: "url _id type format thumbnail duration post",
              },
            ],
          },
        ],
      })
      .populate({
        path: "comment",
        populate: {
          path: "author",
          select: "name username verified is_online profile_image"
        }
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let total;

    if (!totalItems) {
      total = await Notifications.countDocuments({
        recipient: userId
      });
    } else {
      total = totalItems;
    }
    const totalPages = Math.ceil(total / limit);

    // Formata a resposta
    res.status(200).json({
      notifications,
      pagination: {
        page,
        totalPages,
        total,
        hasMore: page < totalPages, // Indica se há mais páginas
      }
    });
  } catch (err) {
    console.error("Erro ao notificacoes postagem:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getAllNotifications;
