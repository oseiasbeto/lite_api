const Post = require("../../../models/Post");
const Comment = require("../../../models/Comment");
const User = require("../../../models/User");
//const Notification = require("../../../models/Notification");
//const { getIO } = require("../../../services/socket");

const toggleDownvoteComment = async (req, res) => {
    try {
        const postId = req.params.postId; 
        const commentId = req.params.commentId; 
        const userId = req.user.id;

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

        const comment = await Comment.findOne({
            _id: commentId
        })

        if (!comment) return res.status(400).send({
            message: "Algo deu errado."
        })

        const author = await User.findById(post?.author).select(
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

        if (comment.downvotes.includes(userId)) {

            comment.downvotes = comment.downvotes.filter((uId) => uId.toString() !== userId);
            comment.downvotes_count -= 1;
            await comment.save();

            return res.status(200).json({ message: "Voto negativo removido com sucesso", comment });
        } else {

            comment.downvotes.push(userId);
            comment.downvotes_count += 1;

            if (comment.upvotes.includes(userId)) {
               comment.upvotes = comment.upvotes.filter((uId) => uId.toString() !== userId); 
               comment.upvotes_count -= 1
            }
            
            await comment.save();

            return res.status(200).json({ message: "Voto negativo adicionado com sucesso", comment });
        }
    } catch (err) {
        console.error("Erro ao adicionar ou remover voto negativo no comentario:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = toggleDownvoteComment;
