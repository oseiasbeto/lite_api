const Post = require("../../../models/Post");
const User = require("../../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

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
            "username activity_status unread_notifications_count"
        );

        if (!author) {
            return res
                .status(400)
                .json({ message: "O autor do post não foi encontrado" });
        }

        // Verifica se o usuário está tentando curtir seu próprio post

        /*
        if (post.author.toString() === userId.toString()) {
            return res
                .status(400)
                .json({ message: "Você não pode votar em seu próprio post" });
        } 
        */

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

            if (false /*post.author?._id.toString() !== user?._id.toString()*/) {
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

            return res.status(200).json({ message: "Voto adicionado com sucesso", post });
        }
    } catch (err) {
        console.error("Erro ao adicionar ou remover voto na postagem:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleUpvotePost;
