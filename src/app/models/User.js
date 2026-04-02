// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // === IDENTIFICAÇÃO PRINCIPAL ===
    email: {
      type: String,
      required: [
        function () {
          return !this.googleId && !this.facebookId;
        },
        "O e-mail é obrigatório para usuários que não usam redes sociais."
      ],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Por favor, insira um endereço de e-mail válido."],
    },

    username: {
      type: String,
      required: [true, "Username é obrigatório"],
      unique: true,
      trim: true,
      minlength: [3, "Mínimo 3 caracteres"],
      maxlength: [30, "Máximo 30 caracteres"],
      match: [/^[a-zA-Z0-9_]+$/, "Apenas letras, números e underscore"]
    },

    name: {
      type: String,
      default: "",
      maxlength: [50, "Máximo 50 caracteres"]
    },

    phone_number: {
      type: String,
      match: [/^\+?[1-9]\d{1,14}$/, "Por favor, insira um número de telefone válido."],
      default: "",
    },

    // === PERFIL VISUAL ===
    profile_image: {
      public_id: { type: String, default: null },
      url: {
        type: String,
        default: "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"
      }
    },

    // PERFIL DO USUÁRIO ===
    bio: {
      type: String,
      maxlength: [160, "Bio máxima de 160 caracteres"],
      default: ""
    },
    birth_date: {
      type: Date,
      required: false,
    },
    website: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },
    location: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    interests: [{
      type: String,
    }],
    relationship_status: {
      type: String,
      enum: ["single", "in_a_relationship", "married", "divorced", "complicated"],
      default: "single",
    },
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    subscriptions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],

    is_verified: {
      type: Boolean,
      default: false
    },

    // === RECOMPENSAS E MOEDAS ===
    coin_balance: {
      type: Number,
      default: 0,
      min: 0
    },

    // total de recompensas ganhas ao longo do tempo
    total_rewards_earned: {
      type: Number,
      default: 0
    },

    // total de moedas convertidas em dinheiro real
    total_coins_converted: {
      type: Number,
      default: 0
    },

    // status da verificação de conta (KYC)
    account_verification_status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending"
    },

    // === STATUS E PRESENÇA ===
    is_online: { type: Boolean, default: false },
    last_seen: { type: Date, default: null },
    socket_id: { type: String, default: null },
    activity_history: [{ type: mongoose.Schema.Types.Mixed }],

    // === NOTIFICAÇÕES PUSH ===
    player_id_onesignal: { type: String, default: null },

    // === CONTADORES ===
    unread_messages_count: { type: Number, default: 0 },
    unread_notifications_count: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    total_answers: { type: Number, default: 0 },
    total_upvotes_recived: { type: Number, default: 0 },
    total_downvotes_recived: { type: Number, default: 0 },
    posts_count: { type: Number, default: 0 },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    subscriptions_count: { type: Number, default: 0 },

    // === AUTENTICAÇÃO ===
    google_id: String,
    facebook_id: String,
    two_factor_enabled: { type: Boolean, default: false },
    two_factor_secret: { type: String, select: false },
    email_code: { type: Number },
    email_code_expires: { type: Date },
    email_code_attempts: { type: Number },
    reset_password_code: { type: Number },
    reset_password_expires: { type: Date },
    reset_password_attempts: { type: Number },
    password: { type: String },

    // === CONFIGURAÇÕES ===
    settings: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system"
      },
      notification: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        new_answer_on_my_question: { type: Boolean, default: true },
        someone_upvotes_my_question: { type: Boolean, default: true }
      },
      language: {
        type: String,
        default: "pt-BR"
      },
      privacy: {
        last_seen: {
          type: String,
          enum: ["everybody", "followers", "nobody"],
          default: "everybody"
        },
        profile_visibility: { type: String, enum: ["everybody", "followers", "nobody"], default: "everybody" },
        message: { type: String, enum: ["everybody", "followers", "nobody"], default: "everybody" },
      }
    },

    // === OUTROS ===
    is_deleted: { type: Boolean, default: false }, // soft delete
    deleted_at: { type: Date, default: null },

    blocked_users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    muted_conversations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Conversation" }],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// === ÍNDICES PARA PERFORMANCE ===
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ is_online: 1, last_seen: -1 })

// === VIRTUAL: nome exibido (como Telegram: Name ou @username) ===
userSchema.virtual("display_name").get(function () {
  return this.name || `@${this.username}`;
});

module.exports = mongoose.model("User", userSchema);