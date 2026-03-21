const mongoose = require('mongoose');
const cloudinary = require('../services/cloudinary');

const media = new mongoose.Schema({
  public_id: {
    type: String,
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  format: String,
  width: Number,
  height: Number,
  thumbnail: String,
  duration: {  // Adicionado para vídeos
    type: Number,
    required: function () { return this.type === 'video'; }
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "target_model", // Referência dinâmica
  },
  target_model: {
    type: String,
    enum: ["Conversation", "Post", "Comment", null],
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } // Adiciona timestamps automáticos.
});


// Middleware para deletar do Cloudinary
media.pre('remove', async function (next) {
  try {
    // Deleta todos os recursos relacionados no Cloudinary
    await cloudinary.api.delete_resources_by_prefix(`videos/${this.public_id}`, {
      resource_type: 'video',
      type: 'upload'
    });

    console.log(`Todos os recursos HLS/MP4 deletados para ${this.public_id}`);
    next();
  } catch (error) {
    console.error('Erro ao deletar mídia do Cloudinary:', error);
    next(error);
  }
});


const Media = mongoose.model('Media', media);

module.exports = Media;