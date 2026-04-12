const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");

const followUser = async (req, res) => {
    try {
        const userIdToFollow = req.params.user_id;
        const loggedUserId = req.user.id;

        if (!userIdToFollow) {
            return res
                .status(400)
                .json({ message: "O id do usuário a seguir é obrigatório." });
        }

        const userToFollow = await User.findOne({ _id: userIdToFollow }).select(
            "username privacy_settings activity_status following followers following_count followers_count name socket_id is_online profile_image settings player_id_onesignal"
        );
        
        if (!userToFollow) {
            return res
                .status(404)
                .json({ message: "Usuário a seguir não encontrado." });
        }

        if (userToFollow._id.toString() === loggedUserId.toString()) {
            return res
                .status(400)
                .json({ message: "Você não pode seguir a si mesmo." });
        }

        const user = await User.findOne({ _id: loggedUserId }).select("following following_count followers followers_count name socket_id is_online profile_image");
        
        if (!user) {
            return res
                .status(400)
                .json({ message: "Houve um erro, tente novamente!" });
        }

        // Verifica se o usuário já segue
        const hasFollowed = user.following.includes(userToFollow._id.toString());

        if (hasFollowed) {
            // UNFOLLOW
            user.following = user.following.filter(uId => uId.toString() !== userToFollow._id.toString());
            user.following_count -= 1;

            userToFollow.followers = userToFollow.followers.filter(uId => uId.toString() !== loggedUserId?.toString());
            userToFollow.followers_count -= 1;

            await user.save();
            await userToFollow.save();

            // Opcional: Marcar notificação como lida ou remover ao deixar de seguir
            await Notification.updateMany(
                {
                    recipient: userToFollow._id,
                    sender: loggedUserId,
                    type: "new_follower",
                    read: false
                },
                {
                    $set: { read: true }
                }
            );

            return res.status(200).json({
                message: "Você deixou de seguir o usuário com sucesso.",
                userStatusFollow: {
                    following: user.following,
                    following_count: user.following_count,
                    followers: user.followers,
                    followers_count: user.followers_count
                },
                profileStatusFollow: {
                    following: userToFollow.following,
                    following_count: userToFollow.following_count,
                    followers: userToFollow.followers,
                    followers_count: userToFollow.followers_count
                }
            });
        } else {
            // FOLLOW
            user.following.push(userToFollow._id);
            user.following_count += 1;
            await user.save();

            userToFollow.followers.push(loggedUserId);
            userToFollow.followers_count += 1;
            await userToFollow.save();

            const isFollowBack = user.followers.includes(userToFollow._id.toString());
            
            // LÓGICA DE NOTIFICAÇÃO COM PREVENÇÃO DE SPAM
            const isSameUser = userToFollow._id.toString() === loggedUserId.toString();
            
            if (!isSameUser) {
                const notificationType = "new_follower";
                const timeThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hora
                
                // VERIFICA SE JÁ EXISTE UMA NOTIFICAÇÃO RECENTE DO MESMO REMETENTE
                const existingNotificationFromSameSender = await Notification.findOne({
                    recipient: userToFollow._id,
                    sender: loggedUserId,
                    type: notificationType
                });
                
                // Se já existe notificação recente do mesmo usuário, NÃO ENVIA NOVA
                if (existingNotificationFromSameSender) {
                    console.log(`Notificação ignorada: Usuário ${loggedUserId} já seguiu ${userToFollow._id} recentemente`);
                    return res.status(200).json({
                        message: isFollowBack
                            ? "Você seguiu o usuário de volta com sucesso."
                            : "Você começou a seguir o usuário com sucesso.",
                        userStatusFollow: {
                            following: user.following,
                            following_count: user.following_count,
                            followers: user.followers,
                            followers_count: user.followers_count
                        },
                        profileStatusFollow: {
                            following: userToFollow.following,
                            following_count: userToFollow.following_count,
                            followers: userToFollow.followers,
                            followers_count: userToFollow.followers_count
                        },
                        notificationSent: false // Indica que não enviou notificação
                    });
                }
                
                const io = getIO();
                const message = `começou a seguir você.`;
                
                // Verifica se o usuário está online
                if (userToFollow?.is_online) {
                    const newNotification = new Notification({
                        recipient: userToFollow._id,
                        sender: loggedUserId,
                        type: notificationType,
                        message: message
                    });
                    
                    await newNotification.save();
                    
                    const populatedNotification = await Notification.findOne({
                        _id: newNotification._id
                    })
                        .populate("recipient", "name username verified is_online profile_image")
                        .populate("sender", "name username verified is_online profile_image");
                    
                    // Incrementa contador de notificações não lidas
                    await User.findByIdAndUpdate(userToFollow._id, {
                        $inc: { unread_notifications_count: 1 }
                    });
                    
                    io.to(userToFollow.socket_id).emit("new_notification", populatedNotification);
                    console.log("Emitindo nova notificacao para socket:", userToFollow?.socket_id);
                } else {
                    // Usuário INATIVO: agrupa notificações de MÚLTIPLOS USUÁRIOS diferentes
                    // Mas NÃO agrupa do mesmo usuário repetido
                    
                    // Verifica se já existe uma notificação agrupada nas últimas horas
                    let existingGroupedNotification = await Notification.findOne({
                        recipient: userToFollow._id,
                        type: notificationType,
                        created_at: { $gte: timeThreshold }
                    });
                    
                    if (existingGroupedNotification) {
                        // Verifica se o remetente atual já está na lista de senders
                        const isNewSender = !existingGroupedNotification.senders ||
                            !existingGroupedNotification.senders.some(
                                senderId => senderId.toString() === loggedUserId.toString()
                            );
                        
                        if (isNewSender) {
                            // Adiciona o novo remetente à lista (apenas se for diferente)
                            await existingGroupedNotification.updateOne({
                                $addToSet: { senders: loggedUserId },
                                $set: { read: false }
                            });
                            
                            // Incrementa o contador de notificações não lidas
                            await User.findByIdAndUpdate(userToFollow._id, {
                                $inc: { unread_notifications_count: 1 }
                            });
                            
                            // Atualiza a mensagem baseada na quantidade de remetentes únicos
                            const uniqueSendersCount = existingGroupedNotification.senders
                                ? existingGroupedNotification.senders.length + 1
                                : 1;
                            
                            let groupedMessage = uniqueSendersCount === 1
                                ? `começou a seguir você.`
                                : `${uniqueSendersCount} pessoas começaram a seguir você.`;
                            
                            await existingGroupedNotification.updateOne({
                                $set: { message: groupedMessage }
                            });
                            
                            // ENVIA PUSH NOTIFICATION para o usuário inativo
                            if (userToFollow && userToFollow?.player_id_onesignal && userToFollow?.settings?.notification?.push) {
                                const pushData = {
                                    userId: userToFollow._id,
                                    title: "Novo seguidor!",
                                    body: groupedMessage,
                                    ...(user?.profile_image?.thumbnails?.push_notification && {
                                        largeIcon: user?.profile_image?.thumbnails?.push_notification
                                    })
                                };
                                
                                try {
                                    await sendPushNotification(pushData);
                                    console.log(`Push notification enviada para ${userToFollow._id}`);
                                } catch (pushError) {
                                    console.error("Erro ao enviar push notification:", pushError);
                                }
                            }
                        } else {
                            // MESMO USUÁRIO tentando enviar notificação novamente - IGNORA
                            console.log(`Notificação agrupada ignorada: Usuário ${loggedUserId} já está na lista de senders`);
                        }
                    } else {
                        // Cria uma nova notificação agrupada
                        const newNotification = new Notification({
                            recipient: userToFollow._id,
                            senders: [loggedUserId],
                            sender: loggedUserId,
                            type: notificationType,
                            message: message,
                            read: false,
                            created_at: new Date()
                        });
                        
                        await newNotification.save();
                        
                        // Incrementa contador de notificações não lidas
                        await User.findByIdAndUpdate(userToFollow._id, {
                            $inc: { unread_notifications_count: 1 }
                        });
                        
                        // ENVIA PUSH NOTIFICATION para o usuário inativo
                        if (userToFollow && userToFollow?.player_id_onesignal && userToFollow?.settings?.notification?.push) {
                            const pushData = {
                                userId: userToFollow._id,
                                title: "Novo seguidor!",
                                body: `começou a seguir você.`,
                                data: {
                                    type: notificationType,
                                    senderId: loggedUserId
                                }
                            };
                            
                            try {
                                await sendPushNotification(pushData);
                                console.log(`Push notification enviada para ${userToFollow._id}`);
                            } catch (pushError) {
                                console.error("Erro ao enviar push notification:", pushError);
                            }
                        }
                    }
                }
            }
            
            return res.status(200).json({
                message: isFollowBack
                    ? "Você seguiu o usuário de volta com sucesso."
                    : "Você começou a seguir o usuário com sucesso.",
                userStatusFollow: {
                    following: user.following,
                    following_count: user.following_count,
                    followers: user.followers,
                    followers_count: user.followers_count
                },
                profileStatusFollow: {
                    following: userToFollow.following,
                    following_count: userToFollow.following_count,
                    followers: userToFollow.followers,
                    followers_count: userToFollow.followers_count
                },
                notificationSent: true // Indica que enviou notificação
            });
        }
    } catch (err) {
        console.error("Erro ao processar ação de seguir/deixar de seguir:", err);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = followUser;