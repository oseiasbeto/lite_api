const Post = require("../../../models/Post");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");

const toggleUpvotePost = async (req, res) => {
    try {
        const postId = req.params.id; // Recupera o ID do post a partir dos parâmetros da URL
        const userId = req.user.id; // Recupera o ID do usuário da sessão autenticada (req.user)

        // Verifica se o usuário atual existe no banco de dados
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: "Usuário não encontrado" });
        }

        // Encontra o post pelo ID
        const post = await Post.findById(postId)

        if (!post) {
            return res.status(400).json({ message: "Post não encontrado" });
        }

        // Verifica se o autor do post existe no banco de dados
        const author = await User.findById(post.author).select(
            "username socket_id is_online activity_status unread_notifications_count"
        );

        if (!author) {
            return res
                .status(400)
                .json({ message: "O autor do post não foi encontrado" });
        }

        if (post.upvotes.includes(userId)) {

            post.upvotes = post.upvotes.filter((uId) => uId.toString() !== userId);
            post.upvotes_count -= 1;
            await post.save();

            return res.status(200).json({ message: "Voto removido com sucesso", post });
        } else {

            post.upvotes.push(userId);
            post.upvotes_count += 1;

            if (post.downvotes.includes(userId)) {
                post.downvotes = post.downvotes.filter((uId) => uId.toString() !== userId);
                post.downvotes_count -= 1
            }

            await post.save();

            // Verifica se o usuário está tentando curtir seu próprio post
            const isOwnPost = post.author._id.toString() === userId.toString();

            // LÓGICA DE NOTIFICAÇÃO COM PREVENÇÃO DE SPAM (apenas se não for o próprio post)
            if (!isOwnPost) {
                const notificationType = "upvote_on_post";
                const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora

                // VERIFICA SE JÁ EXISTE UMA NOTIFICAÇÃO RECENTE DO MESMO REMETENTE para o mesmo post
                const existingNotificationFromSameSender = await Notification.findOne({
                    recipient: author._id,
                    sender: userId,
                    type: notificationType,
                    post: postId
                });

                // Se já existe notificação do mesmo usuário, NÃO ENVIA NOVA
                if (existingNotificationFromSameSender) {
                    console.log(`Notificação de like ignorada: Usuário ${userId} já curtiu o post ${postId} anteriormente`);
                    return res.status(200).json({
                        message: "Voto adicionado com sucesso",
                        post,
                        notificationSent: false
                    });
                }

                const io = getIO();
                const message = 'curtiu seu post';

                // Verifica se o autor está online
                if (author?.is_online) {
                    const newNotification = new Notification({
                        recipient: author._id,
                        sender: userId,
                        type: notificationType,
                        post: postId,
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

                    // Incrementa contador de notificações não lidas
                    await User.findByIdAndUpdate(author._id, {
                        $inc: { unread_notifications_count: 1 }
                    });

                    io.to(author.socket_id).emit("new_notification", populatedNotification);
                    console.log("Emitindo nova notificacao de like para socket:", author?.socket_id);
                } else {
                    // Usuário INATIVO: agrupa notificações de MÚLTIPLOS USUÁRIOS diferentes para o mesmo post

                    // Verifica se já existe uma notificação agrupada nas últimas horas
                    let existingGroupedNotification = await Notification.findOne({
                        recipient: author._id,
                        type: notificationType,
                        post: postId,
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
                                ? 'curtiu seu post.'
                                : `${uniqueSendersCount} pessoas curtiram seu post"}.`;

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
                            message: message,
                            is_read: false,
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
                                body: `curtiu seu post.`,
                                data: {
                                    type: notificationType,
                                    postId: postId,
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

            return res.status(200).json({ message: "Voto adicionado com sucesso", post });
        }
    } catch (err) {
        console.error("Erro ao adicionar ou remover voto na postagem:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleUpvotePost;
