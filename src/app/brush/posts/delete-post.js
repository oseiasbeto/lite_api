const Post = require("../../models/Post")
const Media = require("../../models/Media");
const Comment = require("../../models/Comment");

const deletePost = async (req, res) => {
    try {
        const postId = req.params.id;

        const post = await Post.findOne({
            _id: postId
        })

        if (!post) return res.status(404).send({
            message: "Post nao encontrado."
        })

        await post.deleteOne()

        if (post?.media && post?.media?.length) {
            await Media.deleteMany({
                target: post?._id
            })
        }

        if (post.comment_count) {
            await Comment.deleteMany({
                post: post._id
            })
        }

        // Formata a resposta
        res.status(200).json({
            post,
            message: "Post deletado com sucesso!"
        });
    } catch (err) {
        console.error("Erro ao deletar a postagem:", err);
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = deletePost;
