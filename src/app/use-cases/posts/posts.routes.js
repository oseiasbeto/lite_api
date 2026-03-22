const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const createPost = require("./controllers/create-post")
const getPostsFeed = require("./controllers/get-posts-feed")
//const getPostsByOriginalPost = require("./controllers/get-posts-by-original-post")
const getPostById = require("./controllers/get-post-by-id")
//const getPostsByUserId = require("./controllers/get-posts-by-user-id")
//const getPostsWithMediaByUserId = require("./controllers/get-posts-with-media-by-user-id")
//const getFollowingPosts = require("./controllers/get-following-posts")
//const getLikedPostsByUserId = require("./controllers/get-liked-posts-by-user-id")
//const toggleLikePost = require("./controllers/toggle-like-post")

// configurando as rotas
router.post("/", protectedRoute, createPost)
router.get("/feed", protectedRoute, getPostsFeed)
//router.get("/following", protectedRoute, getFollowingPosts)
//router.get("/profile/feed/:id", protectedRoute, getPostsByUserId)
//router.get("/profile/media/:id", protectedRoute, getPostsWithMediaByUserId)
//router.get("/profile/liked/:id", protectedRoute, getLikedPostsByUserId)
//router.get("/replies/:id", protectedRoute, getPostsByOriginalPost)
router.get("/:id", protectedRoute, getPostById)
//router.put("/like/:id", protectedRoute, toggleLikePost)

// exportando as rotas
module.exports = router