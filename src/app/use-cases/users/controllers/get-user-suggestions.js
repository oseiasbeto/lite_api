// controllers/users/getUserSuggestions.js
const mongoose = require("mongoose");
const User = require("../../../models/User");

const getUserSuggestions = async (req, res) => {
  try {
    const userId = req?.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalItems = parseInt(req.query.total) || 0;

    if (!userId) {
      return res.status(401).json({ message: "Autenticação necessária para sugestões de usuários." });
    }

    // Pega quem eu já sigo e quem bloqueei, para excluir da sugestão
    const me = await User.findById(userId).select("following blocked_users").lean();
    if (!me) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const followingIds = me.following || [];
    const blockedIds = me.blocked_users || [];
    const meObjectId = new mongoose.Types.ObjectId(userId);

    // Filtro base: exclui a mim mesmo, quem já sigo, quem bloqueei e contas inválidas
    const matchStage = {
      _id: { $nin: [meObjectId, ...followingIds, ...blockedIds] },
      blocked_users: { $ne: meObjectId }, // exclui quem me bloqueou
      is_deleted: { $ne: true },
      account_verification_status: { $nin: ["locked", "rejected"] },
      $or: [
        { "settings.privacy.profile_visibility": "everybody" },
        { "settings.privacy.profile_visibility": "followers", followers: meObjectId },
      ],
    };

    const pipeline = [
      { $match: matchStage },
      {
        // Amigos em comum: quantos dos meus "following" também seguem este candidato
        $addFields: {
          mutual_followers_count: {
            $size: {
              $setIntersection: [{ $ifNull: ["$followers", []] }, followingIds],
            },
          },
        },
      },
      {
        // Score de relevância, igual ao "who to follow" do X:
        // amigos em comum pesa mais, depois verificação, depois popularidade
        $addFields: {
          suggestion_score: {
            $add: [
              { $multiply: ["$mutual_followers_count", 10] },
              { $cond: ["$is_verified", 5, 0] },
              { $divide: [{ $ifNull: ["$followers_count", 0] }, 1000] },
            ],
          },
          // display_name é virtual no schema e não sobrevive ao aggregate,
          // então recalculamos aqui para o frontend não precisar de fallback
          display_name: {
            $cond: [
              { $and: [{ $ne: ["$name", null] }, { $ne: ["$name", ""] }] },
              "$name",
              { $concat: ["@", "$username"] },
            ],
          },
        },
      },
      { $sort: { suggestion_score: -1, followers_count: -1, created_at: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          password: 0,
          two_factor_secret: 0,
          email_code: 0,
          email_code_expires: 0,
          email_code_attempts: 0,
          reset_password_code: 0,
          reset_password_expires: 0,
          reset_password_attempts: 0,
          blocked_users: 0,
          muted_conversations: 0,
          activity_history: 0,
          suggestion_score: 0,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    let total;
    if (!totalItems) {
      const countResult = await User.aggregate([{ $match: matchStage }, { $count: "total" }]);
      total = countResult[0]?.total || 0;
    } else {
      total = totalItems;
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      users,
      pagination: {
        page,
        totalPages,
        total,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar sugestões de usuários:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getUserSuggestions;