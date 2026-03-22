const Comment = require("../../models/Comment");
const User = require("../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleLikeComment = async (req, res) => {
    try {
        const commentId = req.params.id; // Recupera o ID do post a partir dos parâmetros da URL
        const userId = req.user.id; // Recupera o ID do usuário da sessão autenticada (req.user)

        // Verifica se o usuário atual existe no banco de dados
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: "Usuário não encontrado" });
        }

        const comment = await Comment.findById(commentId)
            .populate(
                "author",
                "name verified is_online profile_image"
            )
            .populate({
                path: "media",
                select: "url _id type format thumbnail duration post",
            })
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
                        select: "url type thumbnail format width height duration",
                    }
                ],
            })


        if (!comment) {
            return res.status(400).json({ message: "Commentario não encontrado" });
        }

        // Verifica se o autor do comentario existe no banco de dados
        const author = await User.findById(comment.author).select(
            "name verified is_online profile_image"
        );

        if (!author) {
            return res
                .status(400)
                .json({ message: "O autor do comentario não foi encontrado" });
        }

        const likeIndex = comment.reactions.likes.indexOf(userId);

        if (likeIndex !== -1) {
            // Se o usuário já deu like, remover o like
            comment.likes.splice(likeIndex, 1);
            comment.likes_count -= 1;
        } else {
            // Se o usuário não deu like, adicionar like
            comment.likes.push(userId);
            comment.likes_count += 1;

            // Se o usuário deu dislike anteriormente, remover o dislike
            const dislikeIndex = comment.dislikes.indexOf(userId);
            if (dislikeIndex !== -1) {
                comment.dislikes.splice(dislikeIndex, 1);
                comment.dislikes_count -= 1;
            }
        }

        await comment.save();

        res.json({ comment, message: 'Reação atualizada com sucesso' });
        
        /* 
        // Verifica se o usuário já curtiu o comentario
        if (comment.reactions.likes.includes(userId)) {
            // Remove o like
            comment.reactions.likes = comment.reactions.likes.filter((like) => like.toString() !== userId);
            comment.reactions_count.likes -= 1;
            await comment.save();

            return res.status(200).json({ message: "Like removido com sucesso" });
        } else {
            // Adiciona o like
            comment.reactions.likes.push(userId);
            comment.reactions_count.likes += 1;
            await comment.save();

            if (comment.author?._id.toString() !== user?._id.toString()) {
                // Lógica de notificação para o like
                const notificationType = "like";
                const timeThreshold = new Date(Date.now() - 60 * 60 * 1000);

                // Verifica se já existe uma notificação do mesmo usuário para o mesmo post
                let existingNotification = await Notification.findOne({
                    recipient: post.author?._id,
                    type: notificationType,
                    senders: userId,
                    target: postId,
                    created_at: { $gte: timeThreshold },
                });

                const io = getIO();

                if (existingNotification) {
                    // Se já existe uma notificação do mesmo remetente, ignora
                    console.log(
                        `Notificação de like já existe para o remetente ${userId}, ação ignorada.`
                    );
                } else {
                    // Verifica se existe uma notificação agrupada para o mesmo post
                    existingNotification = await Notification.findOne({
                        recipient: post.author._id,
                        type: notificationType,
                        target: postId,
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
                        // Agrupa notificações de likes para o mesmo post
                        let updatedSenders = [...existingNotification.senders];
                        let isNewSender = !updatedSenders.find(
                            (sender) => sender._id.toString() === userId.toString()
                        );

                        if (isNewSender) {
                            updatedSenders.push(userId);

                            const totalSenders = updatedSenders.length;
                            let message =
                                totalSenders === 1
                                    ? `${post?.is_reply
                                        ? "curtiu sua resposta."
                                        : "curtiu seu post."
                                    }`
                                    : `${post?.is_reply
                                        ? "curtiram sua resposta."
                                        : "curtiram seu post."
                                    }`;

                            // Atualiza a notificação existente
                            await existingNotification.updateOne({
                                $set: { message, read: false },
                                $push: { senders: userId },
                            });

                            // Busca detalhes dos remetentes
                            const senderDetails = await User.find(
                                { _id: { $in: updatedSenders } },
                                "username name profile_image verified"
                            ).lean();

                            // Incrementa contador de notificações não lidas
                            await author.updateOne({
                                $inc: { unread_notifications_count: 1 },
                            });

                            // Emite notificação em tempo real
                            if (
                                author.activity_status.is_active &&
                                author.activity_status.socket_id
                            ) {
                                console.log(
                                    "Emitindo newNotification para socket:",
                                    author.activity_status.socket_id
                                );
                                io.to(author.activity_status.socket_id).emit(
                                    "newNotification",
                                    {
                                        _id: existingNotification._id,
                                        type: notificationType,
                                        message,
                                        module: existingNotification.module,
                                        created_at: existingNotification.created_at,
                                        updated_at: Date.now(),
                                        target: post,
                                        target_model: "Post",
                                        senders: senderDetails,
                                    }
                                );
                            }
                        }
                    } else {
                        // Cria uma nova notificação para o like
                        const message = post?.is_reply
                            ? "curtiu sua resposta."
                            : "curtiu seu post.";

                        const notification = new Notification({
                            recipient: post.author._id,
                            senders: [userId],
                            type: notificationType,
                            target: post._id,
                            target_model: "Post",
                            module: postModule,
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
                        await author.updateOne({
                            $inc: { unread_notifications_count: 1 },
                        });

                        // Emite notificação em tempo real
                        if (
                            author.activity_status.is_active &&
                            author.activity_status.socket_id
                        ) {
                            console.log(
                                "Emitindo newNotification para socket:",
                                author.activity_status.socket_id
                            );
                            io.to(author.activity_status.socket_id).emit("newNotification", {
                                _id: notification._id,
                                type: notificationType,
                                message,
                                module: notification.module,
                                created_at: notification.created_at,
                                updated_at: Date.now(),
                                target: post,
                                target_model: "Post",
                                senders: senderDetails,
                            });
                        }
                    }
                }
            }

            return res.status(200).json({ message: "Like adicionado com sucesso" });
        }*/
    } catch (err) {
        console.error("Erro ao atualizar reação:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleLikeComment;
