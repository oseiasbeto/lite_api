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
      postType = 'question',
      sharedPost
    } = req.body;

    const userId = req.user.id;


    if (postType === 'question' && !postQuestion)
      return res.status(400).json({
        success: false,
        message: "Informe a pergunta"
      })
    else if (postQuestion.length > 300) {
      return res.status(400).json({
        success: false,
        error: "O post não pode ter mais de 300 caracteres",
      });
    }

    // Validação manual
    if (!content.trim() && media.length === 0 && postType !== 'question') {
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
          "name verified is_online profile_image"
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
        "username is_online unread_notifications_count"
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
      type: postType,
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
          "name verified is_online profile_image unread_notifications_count"
        )
        .populate({
          path: "shared_post",
          populate: {
            path: "author",
            select: "name verified is_online profile_image unread_notifications_count"
          },
        })
        .populate({
          path: "media",
          select: "url type thumbnail format width height duration",
        })
        .lean();

      // Se for reply, atualizar o post original e criar notificação
      if (false && sharedPostDoc && populatedPost) {


        if (sharedPostDoc.author?._id.toString() !== userId.toString()) {
          // Lógica de notificação para o reply
          const notificationType = "reply";
          const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora
          const io = getIO();

          // Determinar a mensagem com base no tipo de reply
          const isNestedReply = sharedPostDoc.is_reply; // Verifica se o sharedPostDoc é uma resposta
          const message = isNestedReply
            ? "respondeu à sua resposta."
            : "respondeu ao seu post.";

          // Verifica se o autor está ativo
          const isAuthorActive =
            sharedPostDoc.author.activity_status.is_active &&
            sharedPostDoc.author.activity_status.socket_id &&
            typeof sharedPostDoc.author.activity_status.socket_id ===
            "string";

          if (isAuthorActive) {
            // Se o autor está ativo, cria uma notificação individual para cada reply
            const notification = new Notification({
              recipient: sharedPostDoc.author._id,
              senders: [userId],
              type: notificationType,
              target: populatedPost._id,
              module: postModule,
              target_model: "Post",
              message,
              read: false,
            });
            await notification.save();

            // Busca detalhes do remetente
            const senderDetails = await User.find(
              { _id: { $in: [userId] } },
              "username name profile_image verified"
            ).lean();

            // Incrementa contador de notificações não lidas
            await User.findByIdAndUpdate(sharedPostDoc.author._id, {
              $inc: { unread_notifications_count: 1 },
            });

            // Emite notificação em tempo real
            console.log(
              "Emitindo newNotification para socket:",
              sharedPostDoc.author.activity_status.socket_id
            );
            io.to(sharedPostDoc.author.activity_status.socket_id).emit(
              "newNotification",
              {
                _id: notification._id,
                type: notificationType,
                message,
                module: notification.module,
                created_at: notification.created_at,
                updated_at: Date.now(),
                target: populatedPost,
                target_model: "Post",
                senders: senderDetails,
              }
            );
          } else {
            // Se o autor está inativo, tenta agrupar notificações
            let existingNotification = await Notification.findOne({
              recipient: sharedPostDoc.author._id,
              type: notificationType,
              target: sharedPostDoc._id,
              created_at: { $gte: timeThreshold },
            }).populate({
              path: "target",
              select: "content text author created_at",
              populate: {
                path: "author",
                select: "username profile_image name",
              },
            });

            if (existingNotification) {
              // Agrupa notificações de replies para o mesmo post/resposta
              let updatedSenders = [...existingNotification.senders];
              let isNewSender = !updatedSenders.find(
                (sender) => sender._id.toString() === userId.toString()
              );

              if (isNewSender) {
                updatedSenders.push(userId);
              }

              const totalSenders = updatedSenders.length;
              const groupedMessage =
                totalSenders === 1
                  ? message
                  : isNestedReply
                    ? "responderam à sua resposta."
                    : "responderam ao seu post.";

              // Atualiza a notificação existente
              await existingNotification.updateOne({
                $set: { message: groupedMessage, read: false },
                $addToSet: { senders: userId }, // Usa $addToSet para evitar duplicatas no array
              });

              // Incrementa contador de notificações não lidas apenas se for um novo remetente
              if (isNewSender) {
                await User.findByIdAndUpdate(sharedPostDoc.author._id, {
                  $inc: { unread_notifications_count: 1 },
                });
              }
            } else {
              // Cria uma nova notificação para o reply (usuário inativo)
              const notification = new Notification({
                recipient: sharedPostDoc.author._id,
                senders: [userId],
                type: notificationType,
                target: sharedPostDoc._id,
                module: postModule,
                target_model: "Post",
                message,
                read: false,
              });
              await notification.save();

              // Incrementa contador de notificações não lidas
              await User.findByIdAndUpdate(sharedPostDoc.author._id, {
                $inc: { unread_notifications_count: 1 },
              });
            }
          }
        }

        // Atualizar contador de posts do usuário (apenas para posts não-replies)
        if (!isReply) {
          await User.findOneAndUpdate(
            { _id: newPost.author },
            { $inc: { posts_count: 1 } }
          );
        }
      }

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
