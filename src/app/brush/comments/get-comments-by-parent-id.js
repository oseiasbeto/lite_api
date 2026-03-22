const Comment = require("../../models/Comment");
const User = require("../../models/User");

const getCommentsByParentId = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const parentId = req.params.id
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const totalItems = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const isLoad = (req.query.is_load && req.query.is_load === "true") || false;

    // Buscar informações do usuário logado para excluir posts próprios e bloqueados
    const currentUser = await User.findById(userId)
      .select("blocked_users")
      .lean();
    if (!currentUser) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Busca notificações com paginação, ordenadas por created_at (descendente)
    const filter = {
      parent: parentId
    };

    const comments = await Comment.find(filter)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "media",
        select: "url _id type format thumbnail duration post",
      })
      .populate(
        "author",
        "name verified is_online profile_image"
      )
      .populate(
        "replied_user",
        "name verified is_online profile_image"
      )
      .populate({
        path: "parent",
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
      .lean(); // Converte para objeto JavaScript puro

    // Conta o total de notificações para calcular totalPages
    let totalComments;

    if (!isLoad) {
      totalComments = await Comment.countDocuments({
        parent: parentId
      });
    } else {
      totalComments = totalItems;
    }
    const totalPages = Math.ceil(totalComments / limit);

    // Formata a resposta
    res.status(200).json({
      comments,
      page,
      totalPages,
      total: totalComments,
      hasMore: page < totalPages, // Indica se há mais páginas
    });
  } catch (err) {
    console.error("Erro ao buscar as respostas:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getCommentsByParentId;
