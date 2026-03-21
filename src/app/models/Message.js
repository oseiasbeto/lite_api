// models/Message.js
const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  // Quem enviou
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Conteúdo da mensagem
  content: { type: String },

  // Tipo de mensagem (igual Telegram)
  message_type: {
    type: String,
    enum: ['text', 'photo', 'video', 'reaction_message', 'deleted_message', 'voice', 'document', 'sticker', 'contact', 'location', 'poll'],
    default: 'text'
  },

  // Se for mídia
  media: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media", // Referência à coleção Media
    },
  ],
  
  // Reply (responder mensagem)
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },

  // Forward (encaminhar)
  forwarded_from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Forward (encaminhar)
  status: {
    type: String,
    enum: ['sent', 'delivered', 'is_deleted', 'failed', 'draft'],
    default: 'delivered'
  },

  // Quem leu (igual Telegram)
  read_by: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    read_at: { type: Date, default: Date.now }
  }],
  deleted_for: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    emoji: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

// Índices pra performance
messageSchema.index({ createdAt: -1 })
messageSchema.index({ sender: 1 })

module.exports = mongoose.model('Message', messageSchema)