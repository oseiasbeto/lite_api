const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createPost = require("./controllers/create-post")
const getPostsFeed = require("./controllers/get-posts-feed")
const toggleUpvotePost = require("./controllers/toggle-upvote-post")
const toggleDownvotePost = require("./controllers/toggle-downvote-post")
const getPostById = require("./controllers/get-post-by-id")


// configurando as rotas
router.post("/", protectedRoute, createPost)
router.get("/feed", protectedRoute, getPostsFeed)
router.get("/:id", protectedRoute, getPostById)
router.put("/:id/toggle-upvote", protectedRoute, toggleUpvotePost)
router.put("/:id/toggle-downvote", protectedRoute, toggleDownvotePost)

// exportando as rotas
module.exports = router