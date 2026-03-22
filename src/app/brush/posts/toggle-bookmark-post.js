const Post = require("../../models/Post");
const User = require("../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleBookmarkPost = async (req, res) => {
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
                "username name verified activity_status blocked_users posts_count subscribers following following_count followers followers_count profile_image"
            )
            .populate({
                path: "media",
                select: "url _id type format thumbnail duration post",
            })
            .populate({
                path: "shared_post",
                populate: {
                    path: "author",
                    select: "username name verified activity_status blocked_users posts_count subscribers following following_count followers followers_count profile_image",
                },
            });

        if (!post) {
            return res.status(400).json({ message: "Post não encontrado" });
        }

        const index = post.bookmarks.indexOf(user?._id);

        if (index !== -1) {
            post.bookmarks.splice(index, 1);
        } else {
            post.bookmarks.push(userId);
        }

        await post.save();

        res.json({ post, message: 'Reação atualizada com sucesso' });
    } catch (err) {
        console.error("Erro ao adicionar/remover favorito:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleBookmarkPost;
