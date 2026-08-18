const mongoose = require("mongoose");
const Media = require("../../../models/Media");
const User = require("../../../models/User");

const getReelsFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 6, 1);
    const skip = (page - 1) * limit;
    const hasTotal = parseInt(req.query.total) || 0;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Utilizador inválido." });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Sem filtros: apenas media de tipo vídeo
    const matchStage = { type: "video" };

    const pipeline = [
      { $match: matchStage },

      // junta o post dono do vídeo (se existir)
      {
        $lookup: {
          from: "posts",
          localField: "target",
          foreignField: "_id",
          as: "post",
        },
      },
      // preserva mesmo sem post, para não esconder nada por enquanto
      { $unwind: { path: "$post", preserveNullAndEmptyArrays: true } },

      { $sort: { created_at: -1, _id: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },

            {
              $lookup: {
                from: "users",
                localField: "post.author",
                foreignField: "_id",
                as: "author",
                pipeline: [
                  {
                    $project: {
                      name: 1,
                      username: 1,
                      is_verified: 1,
                      verified: 1,
                      profile_image: 1,
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },

            {
              $project: {
                _id: 0,
                id: { $toString: "$_id" },
                post_id: {
                  $cond: [
                    { $ifNull: ["$post._id", false] },
                    { $toString: "$post._id" },
                    null,
                  ],
                },

                video: {
                  url: "$url",
                  format: "$format",
                  thumbnail: "$thumbnail",
                  duration: "$duration",
                  width: "$width",
                  height: "$height",
                },

                caption: { $ifNull: ["$post.content", ""] },
                created_at: { $ifNull: ["$post.created_at", "$created_at"] },

                author: {
                  id: { $toString: "$author._id" },
                  name: "$author.name",
                  username: "$author.username",
                  avatar: {
                    $ifNull: [
                      "$author.profile_image.thumbnails.sm",
                      "$author.profile_image.url",
                    ],
                  },
                  verified: {
                    $ifNull: ["$author.is_verified", "$author.verified"],
                  },
                },

                stats: {
                  likes: { $ifNull: ["$post.upvotes_count", 0] },
                  comments: { $ifNull: ["$post.comments_count", 0] },
                  shares: { $ifNull: ["$post.shares_count", 0] },
                },

                liked: {
                  $in: [userObjectId, { $ifNull: ["$post.upvotes", []] }],
                },
                saved: {
                  $in: [userObjectId, { $ifNull: ["$post.bookmarks", []] }],
                },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await Media.aggregate(pipeline);
    const rawItems = result[0]?.data || [];
    const total = hasTotal || result[0]?.totalCount?.[0]?.count || 0;
    const totalPages = limit ? Math.ceil(total / limit) : 0;

    const currentUser = await User.findById(userId).select("following").lean();
    const isFollowingSet = new Set(
      (currentUser?.following || []).map(String)
    );

    const items = rawItems.map((item) => ({
      ...item,
      author: item.author?.id
        ? { ...item.author, isFollowing: isFollowingSet.has(item.author.id) }
        : item.author,
    }));

    res.status(200).json({
      items,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar reels:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getReelsFeed;