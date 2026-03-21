const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const getMediaByPostId = require("./controllers/get-media-by-post-id")

// configurando as rotas
router.get("/post/:post_id", protectedRoute, getMediaByPostId)

// exportando as rotas
module.exports = router