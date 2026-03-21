const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "O destinatário da notificação é obrigatório."],
      index: true,
    },
    senders: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [], // Array de IDs dos remetentes
      required: true,
    },
    type: {
      type: String,
      enum: [
        "follow", // Novo seguidor
        "follow_request", // Solicitação de seguimento
        "follow_accepted", // Solicitação aceita
        "dislike", // Curtida em um post
        "like", // Curtida em um post
        "reply", // Resposta em um comentario
        "mention", // Menção em um post ou comentário
        "comment", // Comentario de um post
        "shared", // Compartilhamento de um post
        "blocked", // Usuário bloqueado
        "system", // Notificações do sistema
      ],
      required: [true, "O tipo de notificação é obrigatório."],
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "target_model", // Referência dinâmica
      required: false,
    },
    target_model: {
      type: String,
      enum: ["Post", "Relationship", "User", null],
      required: false,
    },
    module: String, // Módulo relacionado à notificação (ex: "posts", "profiles")
    message: {
      type: String,
      trim: true,
      maxlength: [
        280,
        "A mensagem da notificação não pode exceder 280 caracteres.",
      ],
      required: true, // Agora obrigatório para facilitar concatenação
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Índices para buscas eficientes
notificationSchema.index({ recipient: 1, read: 1, created_at: -1 });
notificationSchema.index(
  { recipient: 1, type: 1, target: 1 },
  { unique: false }
); // Para verificar duplicatas por tipo e alvo
notificationSchema.index({ senders: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
