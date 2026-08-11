// controllers/users/getUserFollowers.js
const mongoose = require("mongoose");
const User = require("../../../models/User");

/**
 * Lista os usuários que seguem um determinado usuário (userId, na URL).
 * Mesma lógica de privacidade/bloqueio do getUserFollowing, só que percorrendo
 * o array "followers" em vez de "following".
 */
const getUserFollowers = async (req, res) => {
  try {
    const viewerId = req?.user?.id;
    const userId = req.params?.user_id; // dono da lista de "seguidores"
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalItems = parseInt(req.query.total) || 0;

    if (!viewerId) {
      return res.status(401).json({ message: "Autenticação necessária." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido." });
    }

    const targetObjectId = new mongoose.Types.ObjectId(userId);
    const viewerObjectId = new mongoose.Types.ObjectId(viewerId);

    const targetUser = await User.findById(targetObjectId)
      .select("following followers blocked_users settings.privacy.profile_visibility is_deleted")
      .lean();

    if (!targetUser || targetUser.is_deleted) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const targetBlockedViewer = (targetUser.blocked_users || []).some((id) => id.equals(viewerObjectId));
    if (targetBlockedViewer) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const visibility = targetUser?.settings?.privacy?.profile_visibility || "everybody";
    const viewerIsFollower = (targetUser.followers || []).some((id) => id.equals(viewerObjectId));
    const viewerIsOwner = targetObjectId.equals(viewerObjectId);

    if (visibility === "followers" && !viewerIsFollower && !viewerIsOwner) {
      return res.status(403).json({ message: "Esta conta é privada." });
    }

    const me = await User.findById(viewerObjectId).select("blocked_users").lean();
    const myBlockedIds = me?.blocked_users || [];

    const basePipeline = [
      { $match: { _id: targetObjectId } },
      { $project: { list: "$followers" } },
      { $unwind: { path: "$list", includeArrayIndex: "idx" } },
      {
        $lookup: {
          from: "users",
          localField: "list",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $replaceWith: { $mergeObjects: ["$user", { idx: "$idx" }] } },
      {
        $match: {
          is_deleted: { $ne: true },
          _id: { $nin: myBlockedIds },
          blocked_users: { $ne: viewerObjectId },
        },
      },
    ];

    const pipeline = [
      ...basePipeline,
      { $sort: { idx: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          display_name: {
            $cond: [
              { $and: [{ $ne: ["$name", null] }, { $ne: ["$name", ""] }] },
              "$name",
              { $concat: ["@", "$username"] },
            ],
          },
        },
      },
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
          idx: 0,
          user: 0,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    let total;
    if (!totalItems) {
      const countResult = await User.aggregate([...basePipeline, { $count: "total" }]);
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
    console.error("Erro ao buscar seguidores:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getUserFollowers;