const Post = require("../../../models/Post.js");
const Media = require("../../../models/Media.js");
const User = require("../../../models/User.js");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const createPost = async (req, res) => {
  try {
    const {
      content,
      media,
      postQuestion,
      audience,
      isAnonymous,
      selectedTopics,
      sharedPost
    } = req.body;

    const userId = req.user.id;

    // Validação manual
    if (!content.trim() && media.length === 0 && !sharedPost) {
      return res.status(400).json({
        success: false,
        error: "O post deve conter texto ou mídia",
      });
    }

    if (content.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "O post não pode ter mais de 4000 caracteres",
      });
    }

    if (media.length > 4) {
      return res.status(400).json({
        success: false,
        error: "Você pode adicionar no máximo 4 mídias",
      });
    }

    // Verificar se o post original existe (para replies)
    let sharedPostDoc = null;
    if (sharedPost) {
      sharedPostDoc = await Post.findById(sharedPost)
        .populate({
          path: "media",
          select: "url _id type format thumbnail duration post",
        })
        .populate(
          "author",
          "name is_verified credentials is_online profile_image"
        )
      if (!sharedPostDoc) {
        return res.status(404).json({
          success: false,
          error: "Post original não encontrado",
        });
      }
    }

    // Verificar se o autor do post original existe (para replies)
    if (sharedPostDoc) {
      const author = await User.findById(sharedPostDoc.author._id).select(
        "username credentials is_online unread_notifications_count"
      );
      if (!author) {
        return res.status(400).json({
          success: false,
          error: "O autor do post original não foi encontrado",
        });
      }
    }

    const mediaDocs = [];
    for (const mediaItem of media) {

      if (!mediaItem.public_id || !mediaItem.url || !mediaItem.type) {
        return res.status(400).json({
          success: false,
          error: "Dados de mídia inválidos",
        });
      }

      if (mediaItem.type === "video" && !mediaItem.duration) {
        return res.status(400).json({
          success: false,
          error: "Vídeos devem incluir a duração",
        });
      }

      const mediaDoc = await Media.findOneAndUpdate(
        { public_id: mediaItem.public_id },
        {
          $setOnInsert: {
            public_id: mediaItem.public_id,
            url: mediaItem.url,
            type: mediaItem.type,
            format: mediaItem.format,
            thumbnail: mediaItem.thumbnail,
            width: mediaItem.width,
            height: mediaItem.height,
            duration: mediaItem.duration,
            uploaded_by: userId,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      mediaDocs.push(mediaDoc._id);
    }

    // Criar o post
    const newPost = await Post.create({
      content: content,
      author: userId,
      question: postQuestion,
      is_anonymous: isAnonymous,
      topics: selectedTopics ? selectedTopics : [],
      audience: audience,
      media: mediaDocs,
      shared_post: sharedPost ? sharedPost : undefined,
    });

    if (newPost) {
      // Atualizar as mídias com a referência ao post
      await Media.updateMany(
        { _id: { $in: mediaDocs } },
        { $set: { target: newPost._id } }
      );

      await Post.findByIdAndUpdate(sharedPost, {
        $inc: { shares_count: 1 },
      });

      // Popular os dados para retornar
      const populatedPost = await Post.findById(newPost._id)
        .populate(
          "author",
          "name is_verified credentials is_online profile_image unread_notifications_count"
        )
        .populate({
          path: "shared_post",
          populate: [
            {
              path: "author",
              select: "name is_verified credentials is_online profile_image unread_notifications_count"
            },
            {
              path: "media",
              select: "url type thumbnail format width height duration"
            }
          ],
        })
        .populate({
          path: "media",
          select: "url type thumbnail format width height duration",
        })
        .lean();

      // [TODO] Caso haja um sharePost envie uma notification para o autor

      // [TODO] Enviar uma notificacao para ate no maximo mil subscritores
      // Retornar resposta
      res.status(201).json({
        new_post: populatedPost,
        message: "Post criado com sucesso.",
      });
    }
  } catch (error) {
    console.error("Erro ao criar post:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

module.exports = createPost;
