// controllers/comments/editComment.js
const Comment = require("../../../models/Comment");

const editComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.id;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ message: "O comentário não pode estar vazio." });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comentário não encontrado." });
    }

    if (comment.author.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Você não tem permissão para editar este comentário." });
    }

    comment.content = content.trim();
    comment.edited = true; // ⚠️ precisa existir no schema (Boolean, default: false)
    comment.updated_at = new Date(); // ⚠️ idem
    await comment.save();

    const populated = await Comment.findById(commentId)
      .populate("author", "name username is_verified is_online profile_image")
      .populate("reply_to", "name username is_verified is_online profile_image")
      .populate({
        path: "media",
        select: "url _id type format thumbnail duration post",
      })
      .lean();

    res.status(200).json({ success: true, comment: populated });
  } catch (err) {
    console.error("Erro ao editar comentário:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = editComment;