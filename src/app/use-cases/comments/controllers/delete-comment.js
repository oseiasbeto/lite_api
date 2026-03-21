const Comment = require("../../../models/Comment");
const Post = require("../../../models/Post");

const deleteComment = async (req, res) => {
    try {
        const commentId = req.params.id;

        const comment = await Comment.findOne({
            _id: commentId
        })

        if (!comment) return res.status(404).send({
            message: "Comentario nao encontrado."
        })

        await comment.deleteOne()

        if (comment?.media && comment?.media?.length) {
            await Media.deleteMany({
                target: comment?._id
            })
        }

        if (comment.replies_count) {
            await Comment.deleteMany({
                parent: comment?._id
            })
        }

        if (comment.parent) {
            await Comment.findByIdAndUpdate(comment.parent, {
                $inc: {
                    replies_count: -1
                }
            })
        } else {
            await Post.findByIdAndUpdate(comment.post, {
                $inc: {
                    comments_count: -1
                }
            })
        }

        // Formata a resposta
        res.status(200).json({
            comment,
            message: "Commentario apagado com sucesso!"
        });
    } catch (err) {
        console.error("Erro ao deletar o comentario:", err);
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = deleteComment;
