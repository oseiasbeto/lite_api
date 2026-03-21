const Notifications = require("../../../models/Notification");

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */

const getReplyNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const isLoad = (req.query.is_load && req.query.is_load === "true") || false;

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const notifications = await Notifications.find({
      recipient: userId,
      type: "reply",
    })
      .sort({ updated_at: -1 }) // Mais recentes primeiro
      .skip(skip)
      .limit(limit)
      .populate(
        "senders",
        "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image"
      ) // Popula username e profile_picture
      .populate({
        path: "target",
        populate: [
          {
            path: "follower author following", // Popula follower e followed dentro de Relationship
            select:
              "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image",
          },
          {
            path: "media",
            select: "url _id type format thumbnail duration post",
          },
          {
            path: "original_post",
            populate: [
              {
                path: "author",
                select:
                  "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image",
              },
              {
                path: "media",
                select: "url _id type format thumbnail duration post",
              },
            ],
          },
        ],
      })
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let total;

    if (!isLoad) {
      total = await Notifications.countDocuments({
        recipient: userId,
        type: "reply",
      });
    } else {
      total = totalItems;
    }
    const totalPages = Math.ceil(total / limit);

    // Formata a resposta
    res.status(200).json({
      notifications,
      page,
      totalPages,
      total,
      hasMore: page < totalPages, // Indica se há mais páginas
    });
  } catch (err) {
    console.error("Erro ao notificacoes postagem:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getReplyNotifications;
