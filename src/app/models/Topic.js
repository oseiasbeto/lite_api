const mongoose = require("mongoose");

const topic = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true
    },

    total_posts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, // Adiciona timestamps automáticos.
  }
);

// Índices para melhorar performance nas buscas
topic.index({ name: 'text', created_at: -1 });

const Topic = mongoose.model("Topic", topic);

module.exports = Topic;
