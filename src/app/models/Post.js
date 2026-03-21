const mongoose = require("mongoose");

const post = new mongoose.Schema(
  {
    content: {
      type: String,
      required: function () {
        if (!this.media.length && !this.shared_post) return true;
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
    comments_count: {
      type: Number,
      default: 0,
    },
    shared_post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null
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

// Middleware para processamento antes de salvar
post.pre("save", function (next) {
  const post = this;

  // Extrair hashtags
  if (post.content) {
    const hashtagRegex = /#(\w+)/g;
    const hashtags = post.content.match(hashtagRegex);
    if (hashtags) {
      post.hashtags = [
        ...new Set(hashtags.map((tag) => tag.substring(1).toLowerCase())),
      ];
    }
  }

  next();
});

// Índices para melhorar performance nas buscas
post.index({ author: 1, created_at: -1 });
post.index({ hashtags: 1 });
post.index({ created_at: -1 });

const Post = mongoose.model("Post", post);

module.exports = Post;
