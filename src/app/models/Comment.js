const mongoose = require("mongoose");

const comment = new mongoose.Schema(
  {
    content: {
      type: String,
      required: function () {
        if (!this.media.length) return true;
        else return false;
      },
      maxlength: 2000,
      trim: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true
    },

    reply_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    
    is_anonymous: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ['active', 'deleted', 'hidden', 'reported'],
      default: 'active'
    },

    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    upvotes_count: {
      type: Number,
      default: 0,
    },

    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    downvotes_count: {
      type: Number,
      default: 0,
    },

    replies_count: {
      type: Number,
      default: 0,
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
comment.index({ parent: 1, created_at: -1 });
comment.index({ post: 1, created_at: -1 });

const Comment = mongoose.model("Comment", comment);

module.exports = Comment;
