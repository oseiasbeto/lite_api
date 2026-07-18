const Post = require("../../../models/Post");
const User = require("../../../models/User");
const mongoose = require("mongoose");

/**
 * Busca todas as notificações do usuário logado com paginação.
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
const getPostsFeed = async (req, res) => {
  try {
    const userId = req.user.id; // ID do usuário logado
    const page = parseInt(req.query.page) || 1; // Página atual (padrão: 1)
    const limit = parseInt(req.query.limit) || 10; // Limite por página (padrão: 10)
    const skip = (page - 1) * limit; // Quantidade de documentos a pular
    const hasTotal = parseInt(req.query.total) || 0; // Limite por página (padrão: 10)
    const feedType = req.query.type || "foryou"; // 'foryou' | 'following' | 'trending'

    const filters = {};

    // só mostra posts de quem o usuário segue, em ordem cronológica.
    if (feedType === "following") {
      const currentUser = await User.findById(userId).select("following").lean();
      const followingIds = currentUser?.following || [];

      filters.author = { $in: followingIds };
    }

    if (feedType === "trending") {
      const TRENDING_WINDOW_DAYS = 7;
      const windowStart = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      filters.created_at = { $gte: windowStart };
    }

    let posts;
    let total;

    if (feedType === "trending") {
      const pipeline = [
        { $match: filters },
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $ifNull: ["$upvotes_count", 0] },
                { $ifNull: ["$comments_count", 0] },
                { $ifNull: ["$shares_count", 0] },
              ],
            },
          },
        },
        { $sort: { engagementScore: -1, created_at: -1 } },
        { $skip: skip },
        { $limit: limit },

        // populate "media"
        {
          $lookup: {
            from: "media", // ajuste se a collection tiver outro nome
            localField: "media",
            foreignField: "_id",
            as: "media",
            pipeline: [
              {
                $project: {
                  url: 1,
                  type: 1,
                  width: 1,
                  height: 1,
                  format: 1,
                  thumbnail: 1,
                  duration: 1,
                  post: 1,
                },
              },
            ],
          },
        },

        // populate "author"
        {
          $lookup: {
            from: "users", // ajuste se a collection tiver outro nome
            localField: "author",
            foreignField: "_id",
            as: "author",
            pipeline: [
              {
                $project: {
                  name: 1,
                  verified: 1,
                  is_verified: 1,
                  is_online: 1,
                  followers: 1,
                  profile_image: 1,
                  credentials: 1,
                  username: 1,
                  location: 1,
                },
              },
            ],
          },
        },
        { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },

        // populate "shared_post" (com seu author e media aninhados)
        {
          $lookup: {
            from: "posts", // ajuste se a collection tiver outro nome
            localField: "shared_post",
            foreignField: "_id",
            as: "shared_post",
            pipeline: [
              {
                $lookup: {
                  from: "users",
                  localField: "author",
                  foreignField: "_id",
                  as: "author",
                  pipeline: [
                    {
                      $project: {
                        name: 1,
                        verified: 1,
                        is_verified: 1,
                        is_online: 1,
                        followers: 1,
                        profile_image: 1,
                        credentials: 1,
                        username: 1,
                        location: 1,
                      },
                    },
                  ],
                },
              },
              { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "media",
                  localField: "media",
                  foreignField: "_id",
                  as: "media",
                  pipeline: [
                    {
                      $project: {
                        url: 1,
                        type: 1,
                        width: 1,
                        height: 1,
                        format: 1,
                        thumbnail: 1,
                        duration: 1,
                        post: 1,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        { $unwind: { path: "$shared_post", preserveNullAndEmptyArrays: true } },
      ];

      posts = await Post.aggregate(pipeline);

      if (!hasTotal) {
        total = await Post.countDocuments(filters);
      } else {
        total = hasTotal;
      }
    } else {
      // fluxo original (foryou / following), inalterado
      posts = await Post.find(filters)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "media",
          select: "url _id type width height format thumbnail duration post",
        })
        .populate(
          "author",
          "name verified is_online is_verified username followers profile_image credentials location"
        )
        .populate({
          path: "shared_post",
          populate: [
            {
              path: "author",
              select:
                "name verified is_verified is_online followers profile_image credentials username location",
            },
            {
              path: "media",
              select: "url _id type width height format thumbnail duration post",
            },
          ],
        })
        .lean();

      if (!hasTotal) {
        total = await Post.countDocuments(filters);
      } else {
        total = hasTotal;
      }
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      posts,
      page,
      totalPages,
      total,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("Erro ao buscar postagem:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getPostsFeed;