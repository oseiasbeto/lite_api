const Comment = require("../../../models/Comment.js");
const Post = require("../../../models/Post.js");
const Media = require("../../../models/Media.js");
const User = require("../../../models/User.js");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const createComment = async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = req.params.id || null;

        const { content, replyTo, media, parentId } = req.body;

        console.log(replyTo)
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

        if (!post) return res.status(400).send({
            message: "Nao foi possivel achar um post com este id"
        })

        // Verificar se o comentario existe (para respostas)
        let parentComment = null;
        if (parentId) {
            parentComment = await Comment.findById(parentId)

            if (!parentComment) {
                return res.status(404).json({
                    success: false,
                    error: "O comentario não encontrado",
                });
            }
        }

        // Verificar se o autor do comentario original existe (para replies)
        if (parentId && parentComment) {
            const author = await User.findById(parentComment?.author).select(
                "username is_online unread_notifications_count"
            );
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


            if (false) {
                await post.updateOne(originalPost, {
                    $push: { replies: newPost._id },
                    $inc: { replies_count: 1 },
                });

                if (originalPostDoc.author?._id.toString() !== userId.toString()) {
                    // Lógica de notificação para o reply
                    const notificationType = "reply";
                    const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora
                    const io = getIO();

                    // Determinar a mensagem com base no tipo de reply
                    const isNestedReply = originalPostDoc.is_reply; // Verifica se o originalPostDoc é uma resposta
                    const message = isNestedReply
                        ? "respondeu à sua resposta."
                        : "respondeu ao seu post.";

                    // Verifica se o autor está ativo
                    const isAuthorActive =
                        originalPostDoc.author.is_online.is_active &&
                        originalPostDoc.author.is_online.socket_id &&
                        typeof originalPostDoc.author.is_online.socket_id ===
                        "string";

                    if (isAuthorActive) {
                        // Se o autor está ativo, cria uma notificação individual para cada reply
                        const notification = new Notification({
                            recipient: originalPostDoc.author._id,
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
                        await User.findByIdAndUpdate(originalPostDoc.author._id, {
                            $inc: { unread_notifications_count: 1 },
                        });

                        // Emite notificação em tempo real
                        console.log(
                            "Emitindo newNotification para socket:",
                            originalPostDoc.author.is_online.socket_id
                        );
                        io.to(originalPostDoc.author.is_online.socket_id).emit(
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