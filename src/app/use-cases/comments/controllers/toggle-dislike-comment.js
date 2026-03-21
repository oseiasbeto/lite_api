const Comment = require("../../../models/Comment");
const User = require("../../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleDislikeComment = async (req, res) => {
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
                populate: {
                    path: "author",
                    select:
                        "name verified is_online profile_image",
                },
            });

        if (!comment) {
            return res.status(400).json({ message: "Commentario não encontrado" });
        }

        // Verifica se o autor do comentario existe no banco de dados
        const author = await User.findById(comment.author).select(
            "username activity_status unread_notifications_count"
        );

        if (!author) {
            return res
                .status(400)
                .json({ message: "O autor do comentario não foi encontrado" });
        }

        const dislikeIndex = comment.reactions.dislikes.indexOf(userId);

        if (dislikeIndex !== -1) {
            // Se o usuário já deu dislike, remover o dislike
            comment.dislikes.splice(dislikeIndex, 1);
            comment.dislikes_count -= 1;
        } else {
            // Se o usuário não deu dislike, adicionar dislike
            comment.dislikes.push(userId);
            comment.dislikes_count += 1;

            // Se o usuário deu like anteriormente, remover o like
            const likeIndex = comment.likes.indexOf(userId);
            if (likeIndex !== -1) {
                comment.likes.splice(likeIndex, 1);
                comment.likes_count -= 1;
            }
        }

        await comment.save();

        res.json({ comment, message: 'Reação atualizada com sucesso' });

    } catch (err) {
        console.error("Erro ao atualizar reação:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleDislikeComment;
