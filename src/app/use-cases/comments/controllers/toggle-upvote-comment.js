const Post = require("../../../models/Post");
const Comment = require("../../../models/Comment");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");

const toggleUpvoteComment = async (req, res) => {
    try {
        const postId = req.params.postId; 
        const commentId = req.params.commentId; 
        const userId = req.user.id;

        // Verifica se o usuário atual existe no banco de dados
        const user = await User.findById(userId).select("name username profile_image socket_id is_online settings player_id_onesignal");
        if (!user) {
            return res.status(400).json({ message: "Usuário não encontrado" });
        }

        // Encontra o post pelo ID
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(400).json({ message: "Post não encontrado" });
        }

        const comment = await Comment.findOne({
            _id: commentId
        }).populate("author", "name username profile_image socket_id is_online settings player_id_onesignal");

        if (!comment) return res.status(400).send({
            message: "Algo deu errado."
        });

        // Verifica se o autor do comentário existe
        const author = comment.author;
        if (!author) {
            return res.status(400).json({ message: "O autor do comentário não foi encontrado" });
        }

        // Verifica se o usuário está tentando curtir seu próprio comentário
        const isOwnComment = comment.author._id.toString() === userId.toString();

        if (comment.upvotes.includes(userId)) {
            // REMOVER UPVOTE
            comment.upvotes = comment.upvotes.filter((uId) => uId.toString() !== userId);
            comment.upvotes_count -= 1;
            
            if (comment.downvotes.includes(userId)) {
                comment.downvotes = comment.downvotes.filter((uId) => uId.toString() !== userId);
                comment.downvotes_count -= 1;
            }
            
            await comment.save();

            return res.status(200).json({ 
                message: "Voto removido com sucesso", 
                comment
            });
        } else {
            // ADICIONAR UPVOTE
            comment.upvotes.push(userId);
            comment.upvotes_count += 1;

            if (comment.downvotes.includes(userId)) {
                comment.downvotes = comment.downvotes.filter((uId) => uId.toString() !== userId);
                comment.downvotes_count -= 1;
            }
            
            await comment.save();

            // LÓGICA DE NOTIFICAÇÃO COM PREVENÇÃO DE SPAM (apenas se não for o próprio comentário)
            if (!isOwnComment) {
                const notificationType = "upvote_on_comment";
                const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora

                // VERIFICA SE JÁ EXISTE UMA NOTIFICAÇÃO RECENTE DO MESMO REMETENTE para o mesmo comentário
                const existingNotificationFromSameSender = await Notification.findOne({
                    recipient: author._id,
                    sender: userId,
                    type: notificationType,
                    comment: commentId
                });

                // Se já existe notificação do mesmo usuário, NÃO ENVIA NOVA
                if (existingNotificationFromSameSender) {
                    console.log(`Notificação de like ignorada: Usuário ${userId} já curtiu o comentário ${commentId} anteriormente`);
                    return res.status(200).json({
                        message: "Voto adicionado com sucesso",
                        comment,
                        notificationSent: false
                    });
                }

                const io = getIO();
                const message = 'curtiu seu comentário';

                // Verifica se o autor está online
                if (author?.is_online) {
                    const newNotification = new Notification({
                        recipient: author._id,
                        sender: userId,
                        type: notificationType,
                        post: postId,
                        comment: commentId,
                        message: message
                    });

                    await newNotification.save();

                    const populatedNotification = await Notification.findOne({
                        _id: newNotification._id
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
                    await User.findByIdAndUpdate(author._id, {
                        $inc: { unread_notifications_count: 1 }
                    });

                    io.to(author.socket_id).emit("new_notification", populatedNotification);
                    console.log("Emitindo nova notificacao de like para socket:", author?.socket_id);
                } else {
                    // Usuário INATIVO: agrupa notificações de MÚLTIPLOS USUÁRIOS diferentes para o mesmo comentário

                    // Verifica se já existe uma notificação agrupada nas últimas horas
                    let existingGroupedNotification = await Notification.findOne({
                        recipient: author._id,
                        type: notificationType,
                        comment: commentId,
                        created_at: { $gte: timeThreshold }
                    });

                    if (existingGroupedNotification) {
                        // Verifica se o remetente atual já está na lista de senders
                        const isNewSender = !existingGroupedNotification.senders ||
                            !existingGroupedNotification.senders.some(
                                senderId => senderId.toString() === userId.toString()
                            );

                        if (isNewSender) {
                            // Adiciona o novo remetente à lista
                            await existingGroupedNotification.updateOne({
                                $addToSet: { senders: userId },
                                $set: { read: false }
                            });

                            // Incrementa o contador de notificações não lidas
                            await User.findByIdAndUpdate(author._id, {
                                $inc: { unread_notifications_count: 1 }
                            });

                            // Atualiza a mensagem baseada na quantidade de remetentes únicos
                            const uniqueSendersCount = existingGroupedNotification.senders
                                ? existingGroupedNotification.senders.length + 1
                                : 1;

                            let groupedMessage = uniqueSendersCount === 1
                                ? 'curtiu seu comentário.'
                                : `${uniqueSendersCount} pessoas curtiram seu comentário.`;

                            await existingGroupedNotification.updateOne({
                                $set: { message: groupedMessage }
                            });

                            // ENVIA PUSH NOTIFICATION para o usuário inativo
                            if (author && author?.player_id_onesignal && author?.settings?.notification?.push) {
                                const pushData = {
                                    userId: author._id,
                                    title: "Nova curtida!",
                                    body: `${user.name || "Alguém"} ${groupedMessage}`,
                                    ...(user?.profile_image?.thumbnails?.push_notification && {
                                        largeIcon: user?.profile_image?.thumbnails?.push_notification
                                    }),
                                    data: {
                                        type: notificationType,
                                        postId: postId,
                                        commentId: commentId,
                                        senderId: userId
                                    }
                                };

                                try {
                                    await sendPushNotification(pushData);
                                    console.log(`Push notification de like enviada para ${author._id}`);
                                } catch (pushError) {
                                    console.error("Erro ao enviar push notification:", pushError);
                                }
                            }
                        } else {
                            // MESMO USUÁRIO tentando enviar notificação novamente - IGNORA
                            console.log(`Notificação de like agrupada ignorada: Usuário ${userId} já está na lista de senders`);
                        }
                    } else {
                        // Cria uma nova notificação agrupada
                        const newNotification = new Notification({
                            recipient: author._id,
                            senders: [userId],
                            sender: userId,
                            type: notificationType,
                            post: postId,
                            comment: commentId,
                            message: message,
                            read: false,
                            created_at: new Date()
                        });

                        await newNotification.save();

                        // Incrementa contador de notificações não lidas
                        await User.findByIdAndUpdate(author._id, {
                            $inc: { unread_notifications_count: 1 }
                        });

                        // ENVIA PUSH NOTIFICATION para o usuário inativo
                        if (author && author?.player_id_onesignal && author?.settings?.notification?.push) {
                            const pushData = {
                                userId: author._id,
                                title: "Nova curtida!",
                                body: `${user.name || "Alguém"} curtiu seu comentário.`,
                                data: {
                                    type: notificationType,
                                    postId: postId,
                                    commentId: commentId,
                                    senderId: userId
                                },
                                ...(user?.profile_image?.thumbnails?.push_notification && {
                                    largeIcon: user?.profile_image?.thumbnails?.push_notification
                                })
                            };

                            try {
                                await sendPushNotification(pushData);
                                console.log(`Push notification de like enviada para ${author._id}`);
                            } catch (pushError) {
                                console.error("Erro ao enviar push notification:", pushError);
                            }
                        }
                    }
                }
            }

            return res.status(200).json({ 
                message: "Voto positivo adicionado com sucesso", 
                comment,
                notificationSent: !isOwnComment
            });
        }
    } catch (err) {
        console.error("Erro ao adicionar/remover voto positivo", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleUpvoteComment;