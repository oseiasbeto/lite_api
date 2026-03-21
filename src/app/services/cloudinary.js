const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_APIKEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
  video: {
    streaming_profile: 'hd', // Perfil de streaming recomendado
    codec: 'h264',
    format: 'm3u8'
  }
});

module.exports = cloudinary;
