const mongoose = require("mongoose");

const comment = new mongoose.Schema(
  {
    content: {
      type: String,
      required: function () {
        if (!this.media.length && !this.is_repost) return true;
        else return false;
      },
      maxlength: 280,
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likes_count: {
      type: Number,
      default: 0,
    },
    dislikes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikes_count: {
      type: Number,
      default: 0,
    },
    replies_count: {
      type: Number,
      default: 0,
    },
    replied_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    media: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media", // Referência à coleção Media
      },
    ],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, // Adiciona timestamps automáticos.
  }
);

// Índices para melhorar performance nas buscas
comment.index({ author: 1, created_at: -1 });
comment.index({ hashtags: 1 });
comment.index({ created_at: -1 });

const Comment = mongoose.model("Comment", comment);

module.exports = Comment;
