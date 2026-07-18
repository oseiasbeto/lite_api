const mongoose = require("mongoose");

const post = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
      default: function () {
        return this.type === 'question' ? undefined : ""
      }
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
      default: 0
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
    },

    shares_count: {
      type: Number,
      default: 0
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

    audience: {
      type: String,
      enum: ['everyone', 'limited']
    },

    followers: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }],
      default: []
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    media: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media", // Referência à coleção Media
      }],
      default: []
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, // Adiciona timestamps automáticos.
  }
);

// Índices para melhorar performance nas buscas
// Índices para melhorar performance nas buscas
post.index({ content: 'text', topics: 'text' }); // removido "question", que não existe no schema
post.index({ created_at: -1 });                   // feed "foryou"
post.index({ author: 1, created_at: -1 });        // feed "following"
post.index({ status: 1, created_at: -1 });        // feed "trending" (e reforça foryou/following se 
post.index({ shared_post: 1, created_at: -1 });   // já existia, mantido


const Post = mongoose.model("Post", post);

module.exports = Post;
