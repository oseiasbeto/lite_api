const Post = require("../../../models/Post");
const User = require("../../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleDownvotePost = async (req, res) => {
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

        if (post.downvotes.includes(userId)) {

            post.downvotes = post.downvotes.filter((uId) => uId.toString() !== userId);
            post.downvotes_count -= 1;
            await post.save();

            return res.status(200).json({ message: "Voto baixo removido com sucesso", post });
        } else {

            post.downvotes.push(userId);
            post.downvotes_count += 1;

            if (post.upvotes.includes(userId)) {
               post.upvotes = post.upvotes.filter((uId) => uId.toString() !== userId); 
               post.upvotes_count -= 1
            }
            
            await post.save();

            return res.status(200).json({ message: "Voto baixo adicionado com sucesso", post });
        }
    } catch (err) {
        console.error("Erro ao adicionar ou remover voto baixo na postagem:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleDownvotePost;
