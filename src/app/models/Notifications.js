const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "O destinatário da notificação é obrigatório."],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        "new_answer",
        "new_comment", 
        "upvote_on_answer", 
        "upvote_on_comment",
        "reply_to_comment",
        "best_answer",
        "follow",
        "mention",
      ],
      required: true
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment"
    },
    message: {
      type: String,
      trim: true,
      required: true, // Agora obrigatório para facilitar concatenação
    },
    url: String,
    is_read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Índices para buscas eficientes
notificationSchema.index({ recipient: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ sender: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
