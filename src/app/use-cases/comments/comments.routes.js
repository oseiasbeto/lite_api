const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createComment = require("./controllers/create-comment")
const getCommentsByPostId = require("./controllers/get-comments-by-post-id")
const toggleUpvoteComment = require("./controllers/toggle-upvote-comment")
const toggleDownvoteComment = require("./controllers/toggle-downvote-comment")
const getCommentsByParentId = require("./controllers/get-comments-by-parent-id")
//const deleteComment = require("../../brush/comments/delete-comment")

// configurando as rotas
router.post("/:id", protectedRoute, createComment)
router.get("/:id", protectedRoute, getCommentsByPostId)
router.get("/replies/:id", protectedRoute, getCommentsByParentId)
router.put("/:postId/:commentId/toggle-upvote", protectedRoute, toggleUpvoteComment)
router.put("/:postId/:commentId/toggle-downvote", protectedRoute, toggleDownvoteComment)

//router.delete("/:id", protectedRoute, deleteComment)

// exportando as rotas
module.exports = router