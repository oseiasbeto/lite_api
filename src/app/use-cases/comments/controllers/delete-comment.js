// controllers/comments/deleteComment.js
const Comment = require("../../../models/Comment");
const Post = require("../../../models/Post");

const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comentário não encontrado." });
    }

    // 🔒 apenas o autor pode excluir
    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const isRoot = !comment.parent;
    let deletedRepliesCount = 0;

    if (isRoot) {
      // Exclui todas as respostas em cascata
      await Comment.deleteMany({ parent: commentId });
      // ⬇️ Decrementa APENAS 1 no post (a raiz)
      await Post.findByIdAndUpdate(comment.post, {
        $inc: { comments_count: -1 }
      });
    } else {
      // É uma reply → decrementa replies_count do pai
      const parent = await Comment.findById(comment.parent);
      if (parent) {
        await Comment.findByIdAndUpdate(comment.parent, {
          $inc: { replies_count: -1 }
        });
      }
      // ❌ NÃO mexe no comments_count do post
    }

    // Exclui o comentário (raiz ou reply)
    await Comment.findByIdAndDelete(commentId);



    res.status(200).json({
      success: true,
      commentId,
      parentId: comment.parent || null,
      postId: comment.post,
      deletedRepliesCount,
    });
  } catch (err) {
    console.error("Erro ao excluir comentário:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = deleteComment;