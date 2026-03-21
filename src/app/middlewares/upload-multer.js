const multer = require("multer");

// Armazena na memória para enviar direto ao Cloudinary
const storage = multer.memoryStorage(); 

const uploadMulter = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 2MB máximo
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Apenas imagens são permitidas."), false);
        }
        cb(null, true);
    },
});

module.exports = uploadMulter;
