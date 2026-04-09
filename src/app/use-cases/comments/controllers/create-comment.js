const Comment = require("../../../models/Comment.js");
const Post = require("../../../models/Post.js");
const Media = require("../../../models/Media.js");
const User = require("../../../models/User.js");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");

const createComment = async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = req.params.id || null;

        const { content, replyTo, media, parentId } = req.body;

        if (!postId)
            return res.status({
                message: "Por favor informe o id do post"
            })

        // Validação manual
        if (!content.trim() && media.length === 0) {
            return res.status(400).json({
                message: "O comentario deve conter texto ou mídia",
            });
        }

        if (content.length > 500) {
            return res.status(400).json({
                message: "O comentario não pode ter mais de 500 caracteres",
            });
        }

        if (media.length > 4) {
            return res.status(400).json({
                message: "Você pode adicionar no máximo 4 mídias",
            });
        }

        const post = await Post.findById(postId)
            .populate("author", 'name socket_id is_online profile_image')

        if (!post) return res.status(400).send({
            message: "Nao foi possivel achar um post com este id"
        })

        // Verificar se o comentario existe (para respostas)
        let parentComment = null;
        if (parentId) {
            parentComment = await Comment.findById(parentId)
                .populate("author", 'name socket_id is_online profile_image')

            if (!parentComment) {
                return res.status(404).json({
                    success: false,
                    error: "O comentario não encontrado",
                });
            }
        }

        // Verificar se o autor do comentario original existe (para replies)
        if (parentId && parentComment) {
            const author = await User.findById(parentComment?.author)
            if (!author) {
                return res.status(400).json({
                    success: false,
                    error: "O autor do comentario não foi encontrado",
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
        const newComment = await Comment.create({
            content,
            author: userId,
            post: postId,
            media: mediaDocs,
            parent: parentId,
            reply_to: replyTo
        });

        if (newComment) {
            // Atualizar as mídias com a referência ao post
            await Media.updateMany(
                { _id: { $in: mediaDocs } },
                { $set: { target: newComment?._id } }
            );

            if (!parentId) {
                await post.updateOne({
                    $inc: { comments_count: 1 },
                });
            } else {
                if (parentComment) {
                    await parentComment.updateOne({
                        $inc: {
                            replies_count: 1
                        }
                    })
                }
            }

            // Popular os dados para retornar
            const populatedComment = await Comment.findById(newComment._id)
                .populate(
                    "author",
                    "name username verified is_online profile_image"
                )
                .populate({
                    path: 'parent',
                    populate: {
                        path: 'author',
                        select: 'name username verified is_online profile_image'
                    }
                })
                .populate({
                    path: 'reply_to',
                    select: 'name username verified is_online profile_image'
                })
                .populate({
                    path: "media",
                    select: "url type thumbnail format width height duration",
                })
                .lean();


            // Lógica de notificação para o reply
            const notificationType = parentComment?._id ? "reply_to_comment" : "new_comment";
            const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora
            const io = getIO();

            const message = parentComment?._id
                ? "respondeu à sua resposta."
                : "comentou ao seu post.";

            // Verifica se o autor está ativo

            const author = parentComment?._id ? parentComment?.author : post?.author;

            if (author?.is_online) {
                const newNotification = new Notification({
                    recipient: author._id,
                    sender: userId,
                    type: notificationType,
                    post: post._id,
                    comment: newComment?._id,
                    message
                });

                await newNotification.save()

                const populatedNotification = await Notification.findOne({
                    _id: newNotification?._id
                })
                    .populate("recipient", "name username verified is_online profile_image")
                    .populate("sender", "name username verified is_online profile_image")
                    .populate({
                        path: "post",
                        populate: [
                            {
                                path: "author", 
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

                // Incrementa contador de notificações não lidas
                await User.findByIdAndUpdate(author?._id, {
                    $inc: { unread_notifications_count: 1 },
                });
                io.to(author.socket_id).emit("new_notification", populatedNotification);
                console.log("Emitindo nova notificacao para socket:", author?.socket_id);
            } else if (false) {
                // Se o autor está inativo, tenta agrupar notificações
                let existingNotification = await Notification.findOne({
                    recipient: originalPostDoc.author._id,
                    type: notificationType,
                    target: originalPostDoc._id,
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
                        await User.findByIdAndUpdate(originalPostDoc.author._id, {
                            $inc: { unread_notifications_count: 1 },
                        });
                    }
                } else {
                    // Cria uma nova notificação para o reply (usuário inativo)
                    const notification = new Notification({
                        recipient: originalPostDoc.author._id,
                        senders: [userId],
                        type: notificationType,
                        target: originalPostDoc._id,
                        module: postModule,
                        target_model: "Post",
                        message,
                        read: false,
                    });
                    await notification.save();

                    // Incrementa contador de notificações não lidas
                    await User.findByIdAndUpdate(originalPostDoc.author._id, {
                        $inc: { unread_notifications_count: 1 },
                    });
                }
            }

            // Retornar resposta
            res.status(201).json({
                new_comment: {
                    ...populatedComment,
                    replies: []
                },
                message: "Comentario criado com sucesso.",
            });
        }
    } catch (error) {
        console.error("Erro ao criar um comentario:", error);
        res.status(500).json({
            message: "Erro interno no servidor",
        });
    }
};

module.exports = createComment;