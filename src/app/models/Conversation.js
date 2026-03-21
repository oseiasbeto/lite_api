// models/Conversation.js
const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema({
  // Tipo de conversa
  type: {
    type: String,
    enum: ['direct', 'group', 'channel', 'saved_messages'],
    default: 'direct',
    required: true
  },

  // Participantes
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
    },
    role: {
      type: String,
      enum: ['admin', 'reciver']
    },
    settings: {
      pinned: { type: Boolean, default: false },
      muted_until: { type: Date }, // null = não mutado
    }
  }],

  // Só pra grupo/canal
  name: { type: String },
  description: { type: String, default: '' },
  avatar: { type: String }, // URL do avatar
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Grupo público / link de convite
  is_public: { type: Boolean, default: false },
  invite_link: { type: String, unique: true, sparse: true },

  // Canais têm @username
  username: { type: String, unique: true, sparse: true },

  // É canal de transmissão? (só admins postam)
  is_broadcast: { type: Boolean, default: false },

  // Contador de membros
  member_count: { type: Number, default: 2 },

  // Última mensagem (pra mostrar na sidebar)
  last_message: {
    msg_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    reaction: String,
    message_type: { type: String, default: 'text' },
    created_at: {
      type: Date,
      default: Date.now()
    }
  },

  // Contador de não lidos POR USUÁRIO (igual Telegram)
  unread_count: {
    type: Map,
    of: Number,
    default: () => new Map() // ex: { "507f1f77bcf86cd799439011": 3 }
  },

  muted_until: { type: Date }, // null = não mutado
  read_by: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    read_at: { type: Date, default: Date.now }
  }],
  archived_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deleted_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Saved Messages (Mensagens Salvas)
  is_saved_messages: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})


// Performance na sidebar (ordem correta)
conversationSchema.index({ pinned: -1, 'last_message.created_at': -1 })
conversationSchema.index({ 'last_message.created_at': -1 })

// Busca por nome de grupo/canal
conversationSchema.index({ name: 'text', description: 'text' })

// Canais públicos
conversationSchema.index({ username: 1 })
conversationSchema.index({ invite_link: 1 })

module.exports = mongoose.model('Conversation', conversationSchema)