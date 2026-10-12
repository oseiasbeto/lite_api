// models/Story.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const STORY_TTL_MS = 24 * 60 * 60 * 1000; // story fica visível por 24h
const ARCHIVE_SECONDS = 7 * 24 * 60 * 60; // depois de expirar, fica 7 dias no arquivo do autor

const BACKGROUNDS = ["sunset", "ocean", "grape", "forest", "fire", "night", "candy", "mono"];

const storySchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // photo | video | text
    media_type: { type: String, enum: ["photo", "video", "text"], required: true },

    media: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
      thumb: { type: String, default: null },
      duration: { type: Number, default: 0, max: 60 }, // segundos (vídeo)
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      size: { type: Number, default: null }, // bytes
    },

    // Story de texto
    text_content: { type: String, maxlength: [300, "Máximo 300 caracteres"], default: "" },
    background: { type: String, enum: BACKGROUNDS, default: "sunset" },

    caption: { type: String, maxlength: [200, "Máximo 200 caracteres"], default: "" },

    // everyone = qualquer um | friends = seguidores mútuos | only_me = só o autor
    privacy: { type: String, enum: ["everyone", "friends", "only_me"], default: "everyone" },
    allow_replies: { type: Boolean, default: true },

    // Contadores (atualizados com $inc)
    views_count: { type: Number, default: 0 },
    likes_count: { type: Number, default: 0 },
    replies_count: { type: Number, default: 0 },

    expires_at: { type: Date, default: () => new Date(Date.now() + STORY_TTL_MS), required: true },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

storySchema.pre("validate", function (next) {
  if (this.media_type === "text") {
    if (!this.text_content || !this.text_content.trim()) {
      return next(new Error("O texto do story é obrigatório"));
    }
  } else if (!this.media?.url) {
    return next(new Error("A mídia do story é obrigatória"));
  }
  next();
});

// Feed: stories ativos de um conjunto de autores
storySchema.index({ author: 1, is_deleted: 1, expires_at: -1, created_at: 1 });
// Remove do banco 7 dias DEPOIS de expirar (arquivo do autor)
storySchema.index({ expires_at: 1 }, { expireAfterSeconds: ARCHIVE_SECONDS });

const Story = mongoose.model("Story", storySchema);
Story.BACKGROUNDS = BACKGROUNDS;

module.exports = Story;