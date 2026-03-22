const Post = require("../../models/Post");
const User = require("../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleDislikePost = async (req, res) => {
    try {
        const postId = req.params.id; // Recupera o ID do post a partir dos parâmetros da URL
        const userId = req.user.id; // Recupera o ID do usuário da sessão autenticada (req.user)

        // Verifica se o usuário atual existe no banco de dados
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: "Usuário não encontrado" });
        }

        const post = await Post.findById(postId)
            .populate(
                "author",
                "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image"
            )
            .populate({
                path: "media",
                select: "url _id type format thumbnail duration post",
            })
            .populate({
                path: "shared_post",
                populate: {
                    path: "author",
                    select:
                        "username name verified activity_status blocked_users gender posts_count subscribers following following_count followers followers_count bio email website cover_photo profile_image",
                },
            });

        if (!post) {
            return res.status(400).json({ message: "Post não encontrado" });
        }

        // Verifica se o autor do comentario existe no banco de dados
        const author = await User.findById(post.author).select(
            "username activity_status unread_notifications_count"
        );

        if (!author) {
            return res
                .status(400)
                .json({ message: "O autor do post não foi encontrado" });
        }

        const dislikeIndex = post.reactions.dislikes.indexOf(userId);

        if (dislikeIndex !== -1) {
            // Se o usuário já deu dislike, remover o dislike
            post.reactions.dislikes.splice(dislikeIndex, 1);
            post.reaction_count.dislikes -= 1;
        } else {
            // Se o usuário não deu dislike, adicionar dislike
            post.reactions.dislikes.push(userId);
            post.reaction_count.dislikes += 1;

            // Se o usuário deu like anteriormente, remover o like
            const likeIndex = post.reactions.likes.indexOf(userId);
            if (likeIndex !== -1) {
                post.reactions.likes.splice(likeIndex, 1);
                post.reaction_count.likes -= 1;
            }
        }

        await post.save();

        res.json({ post, message: 'Reação atualizada com sucesso' });
    } catch (err) {
        console.error("Erro ao atualizar reação:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleDislikePost;
