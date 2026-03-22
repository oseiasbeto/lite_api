const mongoose = require("mongoose");

const post = new mongoose.Schema(
  {
    post_type: {
      type: String,
      enum: ['question', 'post'],
      default: 'question',
      index: true
    },

    title: {
      type: String,
      trim: true,
      maxlength: 300
    },

    content: {
      type: String,
      maxlength: 280,
      trim: true
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    topics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Topic",
      }
    ],

    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    bookmarks_count: {
      type: Number,
      default: 0,
    },

    shares_count: {
      type: Number,
      default: 0,
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

    views_count: {
      type: Number,
      default: 0,
    },

    comments_count: {
      type: Number,
      default: 0,
    },

    shared_post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null
    },

    shares_count: {
      type: Number,
      default: 0,
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

    privacy: {
      type: String,
      default: 'public'
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
post.index({ title: 'text', content: 'text', topics: 'text' });
post.index({ post_type: 1, created_at: -1 });
post.index({ author: 1, post_type: 1 });
post.index({ shared_post: 1, created_at: -1 })

const Post = mongoose.model("Post", post);

module.exports = Post;
