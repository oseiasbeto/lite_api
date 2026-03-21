const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createComment = require("./controllers/create-comment")
const getCommentsByPostId = require("./controllers/get-comments-by-post-id")
const getCommentsByParentId = require("./controllers/get-comments-by-parent-id")
const toggleLikeComment = require("./controllers/toggle-like-comment")
const toggleDislikeComment = require("./controllers/toggle-dislike-comment")
const deleteComment = require("./controllers/delete-comment")

// configurando as rotas
router.post("/:id", protectedRoute, createComment)
router.get("/:id", protectedRoute, getCommentsByPostId)
router.get("/replies/:id", protectedRoute, getCommentsByParentId)
router.put("/like/:id", protectedRoute, toggleLikeComment)
router.put("/dislike/:id", protectedRoute, toggleDislikeComment)
router.delete("/:id", protectedRoute, deleteComment)

// exportando as rotas
module.exports = router